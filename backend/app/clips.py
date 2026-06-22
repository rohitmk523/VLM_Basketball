"""Turn a Supabase video_metadata s3_key + [start,end] window into a small mp4 clip.

Two strategies:
  1. extract_clip_remote (DEFAULT): generate a presigned S3 URL and let ffmpeg slice
     the window straight from the object using HTTP range requests. Only the bytes
     for [start,end] (+ the moov index) are downloaded — NOT the whole file. A full
     game angle is ~4-9 GB; this fetches a couple of MB.
  2. ensure_angle_cached + local slice (FALLBACK): download the whole angle file once
     into a local cache, then slice locally. Used only if the ranged path fails.

The production mp4s are non-faststart (moov atom at the end). Ranged seeking still
works as long as `-ss` is given BEFORE `-i` (so ffmpeg seeks the input) and the http
protocol is allowed to reconnect — validated against the live 4.24 GB files.
"""
from __future__ import annotations

import re
import subprocess
from pathlib import Path

from . import config


def _cache_name(s3_key: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]", "_", s3_key)


def _clip_path(s3_key: str, start_sec: float, end_sec: float) -> Path:
    config.CLIP_CACHE.mkdir(parents=True, exist_ok=True)
    return config.CLIP_CACHE / f"{_cache_name(s3_key)}__{start_sec:.2f}_{end_sec:.2f}.mp4"


def presigned_url(s3_key: str, expires: int | None = None) -> str:
    """Time-limited GET URL for the S3 object (no public ACL needed)."""
    import boto3  # noqa: PLC0415

    s3 = boto3.client("s3", region_name=config.S3_REGION)
    return s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": config.S3_BUCKET, "Key": s3_key},
        ExpiresIn=expires or config.S3_PRESIGN_TTL,
    )


def _ffmpeg_slice(src: str, start_sec: float, end_sec: float, out: Path, vf: str, http: bool) -> None:
    """Re-encode [start,end] of `src` into `out` (720p, no audio, faststart)."""
    dur = float(end_sec) - float(start_sec)
    cmd = ["ffmpeg", "-nostdin", "-y"]
    if http:
        # Keep the HTTP source resilient while ffmpeg range-seeks a large remote mp4.
        cmd += ["-reconnect", "1", "-reconnect_streamed", "1", "-reconnect_delay_max", "5"]
    # -ss BEFORE -i => fast input seek (range requests on a seekable http source).
    cmd += ["-ss", f"{float(start_sec):.3f}", "-i", src, "-t", f"{dur:.3f}"]
    if vf:
        cmd += ["-vf", vf]
    cmd += ["-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
            "-movflags", "+faststart", str(out)]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0 or not out.exists() or out.stat().st_size == 0:
        out.unlink(missing_ok=True)
        raise RuntimeError(f"ffmpeg failed:\n{proc.stderr[-2000:]}")


def ensure_angle_cached(s3_key: str) -> Path:
    """FALLBACK: download the whole angle file once into the local cache."""
    config.CLIP_CACHE.mkdir(parents=True, exist_ok=True)
    dst = config.CLIP_CACHE / _cache_name(s3_key)
    if not dst.suffix:
        dst = dst.with_suffix(".mp4")
    if dst.exists() and dst.stat().st_size > 0:
        return dst
    import boto3  # noqa: PLC0415

    tmp = dst.with_suffix(dst.suffix + ".part")
    boto3.client("s3", region_name=config.S3_REGION).download_file(config.S3_BUCKET, s3_key, str(tmp))
    tmp.replace(dst)
    return dst


def extract_clip_remote(s3_key: str, start_sec: float, end_sec: float, vf: str | None = None) -> Path:
    """Slice [start,end] straight from S3 via a presigned URL + HTTP range requests.
    Downloads only the window's bytes, not the whole angle file. Cached by key+window."""
    if end_sec <= start_sec:
        raise ValueError("end_sec must be > start_sec")
    out = _clip_path(s3_key, start_sec, end_sec)
    if out.exists() and out.stat().st_size > 0:
        return out
    url = presigned_url(s3_key)
    _ffmpeg_slice(url, start_sec, end_sec, out, config.DEFAULT_VF if vf is None else vf, http=True)
    return out


def extract_clip(
    s3_key: str,
    start_sec: float,
    end_sec: float,
    vf: str | None = None,
    prefer_remote: bool | None = None,
) -> Path:
    """Produce a clip for [start,end]. Defaults to the ranged remote slice (no full
    download); falls back to downloading the whole angle file once if that fails."""
    if end_sec <= start_sec:
        raise ValueError("end_sec must be > start_sec")
    out = _clip_path(s3_key, start_sec, end_sec)
    if out.exists() and out.stat().st_size > 0:
        return out

    remote = config.PREFER_REMOTE_SLICE if prefer_remote is None else prefer_remote
    if remote:
        try:
            return extract_clip_remote(s3_key, start_sec, end_sec, vf)
        except Exception as e:  # noqa: BLE001
            print(f"[clips] remote ranged slice failed ({e}); downloading full angle file", flush=True)

    src = ensure_angle_cached(s3_key)
    _ffmpeg_slice(str(src), start_sec, end_sec, out, config.DEFAULT_VF if vf is None else vf, http=False)
    return out
