"""Read-only Supabase (PostgREST) client for the basketball annotation project
(mhbrsftxvxxtfgbajrlc): games, plays, video_metadata.

Column names follow docs/14 of the SAM3 repo (the documented schema). We `select=*`
and pick keys DEFENSIVELY so minor naming drift doesn't crash — adjust the candidate
lists below if the live schema differs.
"""
from __future__ import annotations

import httpx

from . import config

_TIMEOUT = httpx.Timeout(30.0)


def _pick(row: dict, *names, default=None):
    for n in names:
        if n in row and row[n] not in (None, ""):
            return row[n]
    return default


def _get(path: str, params: dict) -> list[dict]:
    config.require_supabase()
    url = f"{config.SUPABASE_URL}/rest/v1/{path}"
    headers = {"apikey": config.SUPABASE_KEY, "Authorization": f"Bearer {config.SUPABASE_KEY}"}
    with httpx.Client(timeout=_TIMEOUT) as c:
        r = c.get(url, params=params, headers=headers)
    if r.status_code >= 400:
        raise RuntimeError(f"Supabase {path} -> {r.status_code}: {r.text[:300]}")
    return r.json()


# ---- games ----

def list_games(limit: int = 200) -> list[dict]:
    rows = _get("games", {"select": "*", "order": "date.desc", "limit": str(limit)})
    out = []
    for g in rows:
        gid = _pick(g, "id", "game_id", "uuid")
        t1n = _pick(g, "team1_display_name", "team1_name", default="Team 1")
        t2n = _pick(g, "team2_display_name", "team2_name", default="Team 2")
        out.append({
            "game_id": gid,
            "date": str(_pick(g, "date", "game_date", default="")),
            "label": f"{t1n} vs {t2n}",
            "team1": {"name": t1n, "color": str(_pick(g, "team1_color", default=""))},
            "team2": {"name": t2n, "color": str(_pick(g, "team2_color", default=""))},
        })
    return [g for g in out if g["game_id"]]


def get_game(game_id: str) -> dict:
    rows = _get("games", {"select": "*", "id": f"eq.{game_id}", "limit": "1"})
    return rows[0] if rows else {}


def game_context(game_id: str) -> dict:
    """Roster + team colors for grounding the prompt."""
    g = get_game(game_id)
    if not g:
        return {}
    return {
        "team1": {
            "name": _pick(g, "team1_display_name", "team1_name", default="Team 1"),
            "color": _pick(g, "team1_color", default=""),
            "roster": _pick(g, "roster_team1", default=[]),
        },
        "team2": {
            "name": _pick(g, "team2_display_name", "team2_name", default="Team 2"),
            "color": _pick(g, "team2_color", default=""),
            "roster": _pick(g, "roster_team2", default=[]),
        },
    }


# ---- plays ----

def list_plays(game_id: str, limit: int = 1000) -> list[dict]:
    rows = _get("plays", {
        "select": "*", "game_id": f"eq.{game_id}",
        "order": "start_timestamp.asc", "limit": str(limit),
    })
    out = []
    for p in rows:
        out.append({
            "play_id": str(_pick(p, "id", "play_id")),
            "classification": str(_pick(p, "classification", default="")),
            "note": str(_pick(p, "note", default="")),
            "angle": str(_pick(p, "angle", default="")),
            "start": float(_pick(p, "start_timestamp", "start", default=0) or 0),
            "end": float(_pick(p, "end_timestamp", "end", default=0) or 0),
            "player_a": str(_pick(p, "player_a", default="")),
            "player_b": str(_pick(p, "player_b", default="")),
        })
    return [p for p in out if p["play_id"]]


def get_play(play_id: str) -> dict:
    rows = _get("plays", {"select": "*", "id": f"eq.{play_id}", "limit": "1"})
    if not rows:
        raise KeyError(f"play {play_id} not found")
    p = rows[0]
    return {
        "play_id": str(_pick(p, "id", "play_id")),
        "game_id": str(_pick(p, "game_id", "game")),
        "angle": str(_pick(p, "angle", default="")),
        "start": float(_pick(p, "start_timestamp", "start", default=0) or 0),
        "end": float(_pick(p, "end_timestamp", "end", default=0) or 0),
        "classification": str(_pick(p, "classification", default="")),
        "note": str(_pick(p, "note", default="")),
        "events": _pick(p, "events", default={}),
        "player_a": str(_pick(p, "player_a", default="")),
        "player_b": str(_pick(p, "player_b", default="")),
    }


# ---- video_metadata (s3 key + sync offset per angle) ----

# Far/near camera tag inferred from the s3 filename (angle column is only LEFT/RIGHT).
_CAM_KIND = [
    ("FL", r"(_fl\.mp4|farleft|far_left|far-left)"),
    ("FR", r"(_fr\.mp4|farright|far_right|far-right)"),
    ("NL", r"(_nl\.mp4|nearleft)"),
    ("NR", r"(_nr\.mp4|nearright)"),
]


def cam_kind(s3_key: str) -> str:
    import re  # noqa: PLC0415

    k = (s3_key or "").lower()
    for tag, pat in _CAM_KIND:
        if re.search(pat, k):
            return tag
    return "?"


def _angle_match(v: dict, angle: str) -> bool:
    key = str(_pick(v, "s3_key", default=""))
    if str(_pick(v, "angle", default="")).upper() == angle.upper():
        return True
    # Map LEFT/RIGHT -> far-camera filename tags as a fallback.
    want = {"LEFT": "FL", "RIGHT": "FR"}.get(angle.upper())
    return bool(want and cam_kind(key) == want)


def video_meta(game_id: str, angle: str) -> dict:
    rows = _get("video_metadata", {"select": "*", "game_id": f"eq.{game_id}"})
    chosen = next((v for v in rows if _angle_match(v, angle)), None)
    if chosen is None:
        raise KeyError(f"no video_metadata for game {game_id} angle {angle}")
    key = str(_pick(chosen, "s3_key"))
    return {
        "s3_key": key,
        "s3_url": _pick(chosen, "s3_url", default=None),
        "filename": str(_pick(chosen, "filename", default="")),
        "angle": str(_pick(chosen, "angle", default=angle)),
        "kind": cam_kind(key),
        "duration": _pick(chosen, "duration"),
        "file_size": _pick(chosen, "file_size"),
        "sync_offset_seconds": float(_pick(chosen, "sync_offset_seconds", default=0) or 0),
    }


def clip_window(play: dict, vmeta: dict, pad: float | None = None) -> tuple[float, float]:
    """[t0, t1] in the angle's own time coordinates: play timestamps + sync offset,
    padded each side so the clip captures build-up and outcome (t0 clamped at 0)."""
    off = float(vmeta.get("sync_offset_seconds") or 0)
    pad = config.DEFAULT_CLIP_PAD if pad is None else float(pad)
    t0 = max(0.0, float(play["start"]) + off - pad)
    t1 = float(play["end"]) + off + pad
    return t0, t1
