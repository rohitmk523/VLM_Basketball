"""google-genai wrapper for native-video narration, with per-request API key.

Upload clip (Files API) -> wait ACTIVE -> generate with custom fps (videoMetadata)
+ media_resolution + strict response schema -> parse -> delete the upload.
"""
from __future__ import annotations

import time

from . import config, prompts
from .schemas import NarrationOut, NarrationResult

_MEDIA_RES = {
    "low": "MEDIA_RESOLUTION_LOW",
    "medium": "MEDIA_RESOLUTION_MEDIUM",
    "high": "MEDIA_RESOLUTION_HIGH",
}


def _client(api_key: str | None):
    try:
        from google import genai  # noqa: PLC0415
    except ImportError as e:  # pragma: no cover
        raise RuntimeError(
            "google-genai is not installed. Run: pip install -r backend/requirements.txt"
        ) from e
    return genai.Client(api_key=config.api_key(api_key))


def _upload_active(client, path: str, mime: str, timeout_s: float = 180.0):
    f = client.files.upload(file=path, config={"mime_type": mime})
    deadline = time.time() + timeout_s
    while getattr(f.state, "name", str(f.state)) == "PROCESSING":
        if time.time() > deadline:
            raise TimeoutError(f"File {f.name} still PROCESSING after {timeout_s:.0f}s")
        time.sleep(1.5)
        f = client.files.get(name=f.name)
    if getattr(f.state, "name", str(f.state)) == "FAILED":
        raise RuntimeError(f"Gemini failed to process upload {f.name}")
    return f


def narrate_clip(
    video_path: str,
    *,
    api_key: str | None = None,
    model: str | None = None,
    fps: float | None = None,
    media_resolution: str | None = None,
    temperature: float | None = None,
    mime_type: str = "video/mp4",
    events=None,
    context=None,
    start_sec: float | None = None,
    end_sec: float | None = None,
) -> NarrationResult:
    from google.genai import types  # noqa: PLC0415

    model_id = config.resolve_model(model)
    fps = config.DEFAULT_FPS if fps is None else float(fps)
    media_resolution = (media_resolution or config.DEFAULT_MEDIA_RES).lower()
    temperature = config.DEFAULT_TEMPERATURE if temperature is None else float(temperature)
    if media_resolution not in _MEDIA_RES:
        raise ValueError(f"media_resolution must be one of {list(_MEDIA_RES)}")

    client = _client(api_key)
    uploaded = _upload_active(client, video_path, mime_type)

    vm_kwargs: dict = {"fps": fps}
    if start_sec is not None:
        vm_kwargs["start_offset"] = f"{float(start_sec)}s"
    if end_sec is not None:
        vm_kwargs["end_offset"] = f"{float(end_sec)}s"
    clip_window = {"start_sec": start_sec, "end_sec": end_sec} if (start_sec or end_sec) else None

    video_part = types.Part(
        file_data=types.FileData(file_uri=uploaded.uri, mime_type=uploaded.mime_type),
        video_metadata=types.VideoMetadata(**vm_kwargs),
    )
    user_text = prompts.build_user_prompt(events=events, context=context, clip_window=clip_window)

    cfg = types.GenerateContentConfig(
        system_instruction=prompts.SYSTEM,
        temperature=temperature,
        max_output_tokens=config.DEFAULT_MAX_OUTPUT_TOKENS,
        media_resolution=getattr(types.MediaResolution, _MEDIA_RES[media_resolution]),
        response_mime_type="application/json",
        response_schema=NarrationOut,
    )

    try:
        resp = client.models.generate_content(
            model=model_id,
            contents=[video_part, types.Part(text=user_text)],
            config=cfg,
        )
    finally:
        try:
            client.files.delete(name=uploaded.name)
        except Exception:  # noqa: BLE001
            pass

    parsed = getattr(resp, "parsed", None)
    raw_text = ""
    if isinstance(parsed, NarrationOut):
        narration = parsed
    else:
        raw_text = (resp.text or "").strip()
        narration = NarrationOut.model_validate_json(raw_text)
        raw_text = ""

    usage = {}
    um = getattr(resp, "usage_metadata", None)
    if um is not None:
        usage = {
            "prompt_tokens": getattr(um, "prompt_token_count", None),
            "output_tokens": getattr(um, "candidates_token_count", None),
            "total_tokens": getattr(um, "total_token_count", None),
        }

    return NarrationResult(
        model=model_id,
        fps=fps,
        media_resolution=media_resolution,
        used_events=bool(events or context),
        narration=narration,
        rendered=prompts.render(narration),
        usage=usage,
        raw_text=raw_text,
    )


def list_models(api_key: str | None = None) -> list[dict]:
    client = _client(api_key)
    out = []
    for m in client.models.list():
        actions = list(getattr(m, "supported_actions", []) or [])
        if not actions or "generateContent" in actions:
            out.append({"name": getattr(m, "name", ""), "display_name": getattr(m, "display_name", "")})
    return out
