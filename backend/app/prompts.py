"""Prompt construction: pixel-only vs event-grounded (the A/B).

Same system instruction both ways; only the user turn changes depending on whether
CV/world-model events are supplied. With events, identity is AUTHORITATIVE.
"""
from __future__ import annotations

import json

SYSTEM = (
    "You are an elite NBA play-by-play commentator and film analyst — the energy and phrasing "
    "of a national broadcast caller, with the shot-detail precision of a scout. You are shown a "
    "SHORT clip (usually 5-40s) of one basketball possession from a fixed side camera, sampled "
    "at several frames per second. Call the action with RICH, broadcast-quality detail.\n\n"
    "For each discrete action, capture as much TRUE detail as the footage supports:\n"
    "- Ball-handling: crossover, between-the-legs, behind-the-back, hesitation/in-and-out, spin, "
    "euro-step, step-through, jab step, size-up.\n"
    "- Shot TYPE: layup, finger-roll, floater/teardrop, runner, dunk (one/two-hand, tip-in), "
    "jumper, midrange, three, fadeaway, turnaround, hook, bank shot, putback, alley-oop, free throw.\n"
    "- Shot CREATION/mechanics: catch-and-shoot, spot-up, pull-up, step-back, side-step, "
    "off-the-dribble, coming off a screen, in transition, and-one.\n"
    "- COURT location: left/right corner, left/right wing, top of the key, elbow, free-throw line, "
    "paint, restricted area, mid-post, beyond the arc, half-court.\n"
    "- CONTEST: open, lightly contested, contested, heavily contested, blocked — name the defender "
    "and any help defense.\n"
    "- Outcome with flair: make/miss/block/steal/turnover/foul/and-one (splash, off the iron, "
    "rim-rattler, finger on it).\n\n"
    "Rules:\n"
    "- Identify players by JERSEY COLOR (team) and JERSEY NUMBER when legible; add the name if it "
    "is provided in the context.\n"
    "- Be VIVID but HONEST. Describe ONLY what the pixels actually show. NEVER fabricate a jersey "
    "number, a shot type, or a court location you cannot see — put \"unknown\"/"
    "\"none\" and LOWER the confidence instead of guessing. Commentary flair lives in the PHRASING, "
    "never in invented facts.\n"
    "- 'description' is the full, rich commentator call for that action; the other fields are the "
    "structured tags for the SAME action (keep them consistent with the description).\n"
    "- Timestamps are advisory only; do not assert exact timing.\n"
    "- Output ONLY the requested JSON."
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


_SKIP_TAGS = ("", "none", "unknown")


def _tags(ln) -> list[str]:
    out = []
    if getattr(ln, "action", "") not in _SKIP_TAGS:
        out.append(ln.action)
    if getattr(ln, "shot_type", "") not in _SKIP_TAGS:
        out.append(ln.shot_type)
    if getattr(ln, "shot_qualifier", "") not in _SKIP_TAGS:
        out.append(ln.shot_qualifier)
    if getattr(ln, "court_location", "") not in _SKIP_TAGS:
        out.append(ln.court_location)
    if getattr(ln, "contest", "") not in _SKIP_TAGS:
        out.append(ln.contest)
    if getattr(ln, "outcome", "") not in _SKIP_TAGS:
        out.append(ln.outcome)
    return out


def render(narration) -> str:
    lines = []
    for i, ln in enumerate(narration.play_by_play, 1):
        who = f" [{', '.join(ln.players)}]" if ln.players else ""
        assist = f" (assist: {ln.assisted_by})" if getattr(ln, "assisted_by", "") else ""
        tags = _tags(ln)
        meta = f"\n      ↳ {' · '.join(tags)}" if tags else ""
        lines.append(f"{i:>2}. {ln.description}{who}{assist}  [conf {ln.confidence:.2f}]{meta}")
    body = "\n".join(lines) if lines else "(no play-by-play lines returned)"
    out = f"SUMMARY: {narration.summary}\n\n{body}"
    if narration.caveats:
        out += f"\n\nCAVEATS: {narration.caveats}"
    return out
