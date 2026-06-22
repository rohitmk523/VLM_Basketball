"""Pydantic models for the structured narration output.

Flat + all-required is the most reliable shape for Gemini structured output; the
model is told to use "" / "unknown" / 0.0 where a field is not determinable.
"""
from __future__ import annotations

from pydantic import BaseModel, Field


class PlayLine(BaseModel):
    description: str = Field(description="The play-by-play line, e.g. 'red #7 pulls a fadeaway, blocked by green #10'.")
    players: list[str] = Field(default_factory=list, description="Players as '<color> #<number>' or '<color> <role>'.")
    action: str = Field(default="", description="drive|dribble|pass|screen|shot:layup|jumper|fadeaway|floater|three|block|steal|rebound|turnover|foul")
    outcome: str = Field(default="", description="make|miss|blocked|stolen|turnover|foul|none")
    timestamp: str = Field(default="", description="Advisory clip time. The CV event stream owns exact timing.")
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)


class NarrationOut(BaseModel):
    summary: str = Field(description="One-line possession outcome.")
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
