"""Pre-slice a game's play clips into the local cache so the demo is instant.

On a slow link to S3 each cold slice can take a couple of minutes, so run this
AHEAD of the demo (ideally from a fast network or a box in the bucket's AWS
region). Once cached, the UI serves clips immediately and only the ~20s Gemini
call is live.

Examples:
  # first 8 plays of a game (good default for a demo reel)
  python prewarm.py --game 26bb5808-3925-435e-9f83-d4bebe03c5be

  # specific plays you'll show
  python prewarm.py --game <gid> --plays 1336fc48-...,54be48d9-...

  # everything (slow on a poor connection)
  python prewarm.py --game <gid> --all
"""
from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from app import clips, supabase_client as sb  # noqa: E402


def _fmt(sec: float) -> str:
    return f"{int(sec // 60)}m{int(sec % 60):02d}s" if sec >= 60 else f"{sec:.1f}s"


def main() -> int:
    ap = argparse.ArgumentParser(description="Pre-slice play clips into the cache.")
    ap.add_argument("--game", required=True, help="game_id (uuid)")
    ap.add_argument("--plays", default="", help="comma-separated play_ids (overrides --limit/--all)")
    ap.add_argument("--limit", type=int, default=8, help="prewarm the first N plays (default 8)")
    ap.add_argument("--all", action="store_true", help="prewarm every play in the game")
    args = ap.parse_args()

    if args.plays.strip():
        play_ids = [p.strip() for p in args.plays.split(",") if p.strip()]
        print(f"prewarming {len(play_ids)} specified play(s)")
    else:
        plays = sb.list_plays(args.game)
        if not args.all:
            plays = plays[: args.limit]
        play_ids = [p["play_id"] for p in plays]
        print(f"game {args.game}: prewarming {len(play_ids)} play(s)"
              f"{'' if args.all else f' (first {args.limit}; use --all for every play)'}")

    ok, failed, t_start = 0, [], time.time()
    for i, pid in enumerate(play_ids, 1):
        try:
            play = sb.get_play(pid)
            vmeta = sb.video_meta(play["game_id"], play["angle"])
            t0, t1 = sb.clip_window(play, vmeta)
            label = f"[{i}/{len(play_ids)}] {play['classification']:<10} {vmeta['kind']}/{play['angle']:<5} {t0:.0f}-{t1:.0f}s"
            ts = time.time()
            clip = clips.extract_clip(vmeta["s3_key"], t0, t1)
            size = clip.stat().st_size / 1e6
            print(f"  OK  {label}  {size:.1f}MB in {_fmt(time.time() - ts)}", flush=True)
            ok += 1
        except Exception as e:  # noqa: BLE001
            print(f"  ERR {pid}: {e}", flush=True)
            failed.append(pid)

    print(f"\ndone: {ok}/{len(play_ids)} cached in {_fmt(time.time() - t_start)}"
          + (f"; {len(failed)} failed: {failed}" if failed else ""))
    return 0 if not failed else 1


if __name__ == "__main__":
    raise SystemExit(main())
