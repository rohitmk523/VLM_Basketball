"""FastAPI backend: Supabase plays -> clip + events -> Gemini play-by-play.

Routes are under /api. Gemini calls accept a per-request key via the `api_key`
field or the `X-Goog-Api-Key` header (UI-entered key), falling back to env.
"""
from __future__ import annotations

import json
import tempfile
from pathlib import Path

import uvicorn
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

from . import clips, config, gemini, supabase_client as sb

app = FastAPI(title="VLM_Basketball backend", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS + ["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _key(request: Request, explicit: str | None) -> str | None:
    return explicit or request.headers.get("X-Goog-Api-Key") or request.query_params.get("api_key")


def _parse_json(name: str, value: str | None):
    if not value or not value.strip():
        return None
    try:
        return json.loads(value)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"{name} must be valid JSON: {e}") from e


@app.get("/api/health")
def health() -> dict:
    return {
        "ok": True,
        "defaults": {
            "flash_model": config.FLASH_MODEL,
            "pro_model": config.PRO_MODEL,
            "fps": config.DEFAULT_FPS,
            "media_resolution": config.DEFAULT_MEDIA_RES,
        },
        "supabase_configured": bool(config.SUPABASE_URL and config.SUPABASE_KEY),
    }


@app.get("/api/models")
def models(request: Request, api_key: str | None = None) -> dict:
    try:
        return {"models": gemini.list_models(_key(request, api_key))}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=str(e)) from e


@app.get("/api/games")
def games() -> dict:
    try:
        return {"games": sb.list_games()}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=str(e)) from e


@app.get("/api/games/{game_id}/plays")
def plays(game_id: str) -> dict:
    try:
        return {"plays": sb.list_plays(game_id)}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=str(e)) from e


@app.get("/api/plays/{play_id}")
def play_detail(play_id: str) -> dict:
    try:
        play = sb.get_play(play_id)
        play["context"] = sb.game_context(play["game_id"]) if play.get("game_id") else {}
        return play
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=str(e)) from e


@app.get("/api/plays/{play_id}/clip")
def play_clip(play_id: str):
    try:
        play = sb.get_play(play_id)
        vmeta = sb.video_meta(play["game_id"], play["angle"])
        t0, t1 = sb.clip_window(play, vmeta)
        clip = clips.extract_clip(vmeta["s3_key"], t0, t1)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=str(e)) from e
    return FileResponse(str(clip), media_type="video/mp4", filename=clip.name)


class NarratePlayReq(BaseModel):
    play_id: str
    model: str = "flash"
    fps: float = config.DEFAULT_FPS
    media_resolution: str = config.DEFAULT_MEDIA_RES
    use_events: bool = True
    api_key: str | None = None


@app.post("/api/narrate_play")
def narrate_play(req: NarratePlayReq, request: Request) -> JSONResponse:
    try:
        play = sb.get_play(req.play_id)
        vmeta = sb.video_meta(play["game_id"], play["angle"])
        t0, t1 = sb.clip_window(play, vmeta)
        clip = clips.extract_clip(vmeta["s3_key"], t0, t1)
        events = play.get("events") if req.use_events else None
        context = sb.game_context(play["game_id"]) if req.use_events else None
        result = gemini.narrate_clip(
            str(clip),
            api_key=_key(request, req.api_key),
            model=req.model,
            fps=req.fps,
            media_resolution=req.media_resolution,
            events=events,
            context=context,
        )
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except (RuntimeError, ValueError, TimeoutError) as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    payload = result.model_dump()
    # Same clip the model saw — the frontend plays this to eyeball model vs. video.
    payload["clip_url"] = f"/api/plays/{req.play_id}/clip"
    try:
        size_mb = round(clip.stat().st_size / 1e6, 2)
    except OSError:
        size_mb = None
    payload["clip_source"] = {
        "s3_key": vmeta["s3_key"],
        "angle": vmeta.get("angle"),
        "kind": vmeta.get("kind"),
        "start": round(t0, 2),
        "end": round(t1, 2),
        "seconds": round(t1 - t0, 2),
        "size_mb": size_mb,
        "via": "s3_presigned_range" if config.PREFER_REMOTE_SLICE else "full_download",
    }
    return JSONResponse(payload)


@app.post("/api/narrate")
async def narrate(
    request: Request,
    file: UploadFile = File(...),
    model: str = Form("flash"),
    fps: float = Form(config.DEFAULT_FPS),
    media_resolution: str = Form(config.DEFAULT_MEDIA_RES),
    events: str | None = Form(None),
    context: str | None = Form(None),
    api_key: str | None = Form(None),
) -> JSONResponse:
    events_obj = _parse_json("events", events)
    context_obj = _parse_json("context", context)
    suffix = Path(file.filename or "clip.mp4").suffix or ".mp4"
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    try:
        tmp.write(await file.read())
        tmp.flush()
        tmp.close()
        result = gemini.narrate_clip(
            tmp.name,
            api_key=_key(request, api_key),
            model=model,
            fps=fps,
            media_resolution=media_resolution,
            mime_type=file.content_type or "video/mp4",
            events=events_obj,
            context=context_obj,
        )
    except (RuntimeError, ValueError, TimeoutError) as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    finally:
        Path(tmp.name).unlink(missing_ok=True)
    return JSONResponse(result.model_dump())


def run(host: str = "127.0.0.1", port: int = 8000) -> None:
    uvicorn.run(app, host=host, port=port)
