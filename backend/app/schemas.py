"""Pydantic models for the structured narration output.

Flat + all-required is the most reliable shape for Gemini structured output; the
model is told to use "" / "unknown" / 0.0 where a field is not determinable.
"""
from __future__ import annotations

from pydantic import BaseModel, Field


class PlayLine(BaseModel):
    description: str = Field(
        description="The full, rich NBA-commentator call for this action — vivid and specific, "
        "e.g. 'Blue #7 sizes up at the right wing, rips through a hard crossover, rises into a "
        "contested step-back three over Gray #10 — and BURIES it'.")
    players: list[str] = Field(
        default_factory=list,
        description="Players involved as '<color> #<number>' (add name if known from context).")
    action: str = Field(
        default="",
        description="Primary action: drive|dribble|crossover|behind-the-back|between-the-legs|"
        "hesitation|spin|euro-step|jab-step|size-up|pass|dish|screen/pick|roll|pop|cut|post-up|"
        "shot|block|contest|steal|deflection|rebound|tip|turnover|foul")
    shot_type: str = Field(
        default="none",
        description="If a shot: layup|finger-roll|floater|runner|dunk|tip-in|jumper|midrange|"
        "three|fadeaway|turnaround|hook|bank-shot|putback|alley-oop|free-throw. Else 'none'.")
    shot_qualifier: str = Field(
        default="none",
        description="Shot creation/mechanics: catch-and-shoot|spot-up|pull-up|step-back|side-step|"
        "off-the-dribble|off-screen|transition|and-one|putback. 'none' if not a shot/unclear.")
    court_location: str = Field(
        default="",
        description="Where it happened: left-corner|right-corner|left-wing|right-wing|top-of-key|"
        "left-elbow|right-elbow|free-throw-line|paint|restricted-area|mid-post|beyond-the-arc|"
        "half-court. '' or 'unknown' if unclear.")
    contest: str = Field(
        default="",
        description="Defensive pressure: open|lightly-contested|contested|heavily-contested|blocked. "
        "Name the defender in 'description' when visible.")
    assisted_by: str = Field(
        default="",
        description="Passer who set up a made shot, as '<color> #<number>', else ''.")
    outcome: str = Field(
        default="",
        description="make|miss|blocked|stolen|turnover|foul|and-one|none")
    timestamp: str = Field(default="", description="Advisory clip time. The CV event stream owns exact timing.")
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)


class NarrationOut(BaseModel):
    summary: str = Field(description="A punchy one-line possession recap in commentator voice.")
    play_by_play: list[PlayLine] = Field(default_factory=list)
    caveats: str = Field(default="", description="Where the model was unsure or pixels contradicted provided context.")


class NarrationResult(BaseModel):
    model: str
    fps: float
    media_resolution: str
    used_events: bool
    narration: NarrationOut
    rendered: str
    usage: dict = Field(default_factory=dict)
    raw_text: str = ""
