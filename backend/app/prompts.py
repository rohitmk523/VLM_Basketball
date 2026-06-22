"""Prompt construction: pixel-only vs event-grounded (the A/B).

Same system instruction both ways; only the user turn changes depending on whether
CV/world-model events are supplied. With events, identity is AUTHORITATIVE.
"""
from __future__ import annotations

import json

SYSTEM = (
    "You are an expert basketball play-by-play analyst. You are shown a SHORT clip "
    "(usually 10-40s) of a single basketball play from a fixed side-camera, sampled "
    "at several frames per second. Produce a precise, DESCRIPTIVE play-by-play of "
    "what the involved players do and how the play ends — e.g. 'red #7 drives baseline, "
    "pulls a fadeaway jumper, and is blocked by green #10'.\n\n"
    "Rules:\n"
    "- Identify players by JERSEY COLOR (team) and JERSEY NUMBER when legible.\n"
    "- Name the actions: drive, dribble, crossover, pass, screen/pick, cut, shot "
    "(type: layup/jumper/fadeaway/floater/three), block/contest, steal, rebound, "
    "turnover, foul.\n"
    "- Name the outcome: make / miss / blocked / stolen / turnover / foul.\n"
    "- NEVER invent a jersey number. If a number is not clearly legible, use the team "
    "color and a role (ball-handler, defender, screener) and LOWER the confidence.\n"
    "- Timestamps are advisory only; do not assert exact timing.\n"
    "- Output ONLY the requested JSON. Use \"\" or \"unknown\" and confidence 0.0 where "
    "a field cannot be determined."
)

_NO_EVENTS = (
    "No structured event data is provided for this clip — narrate PURELY from the "
    "pixels. Break the possession into discrete actions, one play-by-play line each. "
    "Where you cannot read a jersey number, fall back to '<color> <role>' and set a "
    "low confidence. Finish with a one-line summary of the possession outcome."
)

_WITH_EVENTS_HEADER = (
    "Authoritative context from our computer-vision world model is provided below. "
    "TRUST it for player identity (team + jersey number), the event type(s), and the "
    "outcome. Your job is to CONFIRM and DESCRIBE what happens on screen using these "
    "identities — do NOT re-identify players or override the events. Name players as "
    "'<color> #<number>' using the provided roster/identities. If the pixels clearly "
    "contradict the context, note it in 'caveats' but default to the provided data."
)


def _pretty(obj) -> str:
    try:
        return json.dumps(obj, indent=2, ensure_ascii=False, default=str)
    except (TypeError, ValueError):
        return str(obj)


def build_user_prompt(events=None, context=None, clip_window=None) -> str:
    if not events and not context:
        return _NO_EVENTS
    parts = [_WITH_EVENTS_HEADER, ""]
    if context:
        parts += ["TEAMS / ROSTER / PLAY CONTEXT:", _pretty(context), ""]
    if events:
        parts += ["CV WORLD-MODEL EVENTS FOR THIS CLIP:", _pretty(events), ""]
    if clip_window:
        parts.append(f"CLIP WINDOW: {_pretty(clip_window)}")
    return "\n".join(parts)


def render(narration) -> str:
    lines = []
    for i, ln in enumerate(narration.play_by_play, 1):
        who = f" [{', '.join(ln.players)}]" if ln.players else ""
        tail = [t for t in (ln.action, ln.outcome if ln.outcome != "none" else "") if t]
        meta = f" ({' / '.join(tail)}, conf {ln.confidence:.2f})" if tail else f" (conf {ln.confidence:.2f})"
        lines.append(f"{i:>2}. {ln.description}{who}{meta}")
    body = "\n".join(lines) if lines else "(no play-by-play lines returned)"
    out = f"SUMMARY: {narration.summary}\n\n{body}"
    if narration.caveats:
        out += f"\n\nCAVEATS: {narration.caveats}"
    return out
