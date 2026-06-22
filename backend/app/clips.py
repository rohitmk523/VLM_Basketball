"""Turn a Supabase video_metadata s3_key + [start,end] window into a small mp4 clip.

Two strategies:
  1. extract_clip_remote (DEFAULT): generate a presigned S3 URL and let ffmpeg slice
     the window straight from the object using HTTP range requests. Only the bytes
     for [start,end] (+ the moov index) are downloaded — NOT the whole file. A full
     game angle is ~4-9 GB; this fetches a couple of MB.
  2. ensure_angle_cached + local slice (FALLBACK): download the whole angle file once
     into a local cache, then slice locally. Used only if the ranged path fails.

Ranged seeking works because `-ss` is given BEFORE `-i` (so ffmpeg seeks the input)
and the http protocol is allowed to reconnect — validated against the live files.

Concurrency: the UI fires several requests for the SAME clip (preview <video>,
narrate, re-renders). Each slice writes to a UNIQUE temp file then atomically renames
into place, and a per-clip lock makes duplicate callers reuse the first result
instead of running competing ffmpegs that would corrupt each other's output.
"""
from __future__ import annotations

import os
import re
import subprocess
import threading
from pathlib import Path

from . import config


def _cache_name(s3_key: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]", "_", s3_key)


# One lock per clip-cache path so concurrent requests for the same clip don't
# both slice it; the second waits, then returns the cached result.
_locks_guard = threading.Lock()
_locks: dict[str, threading.Lock] = {}


def _path_lock(path: Path) -> threading.Lock:
    key = str(path)
    with _locks_guard:
        lk = _locks.get(key)
        if lk is None:
            lk = _locks[key] = threading.Lock()
        return lk


def _clip_path(s3_key: str, start_sec: float, end_sec: float) -> Path:
    config.CLIP_CACHE.mkdir(parents=True, exist_ok=True)
    return config.CLIP_CACHE / f"{_cache_name(s3_key)}__{start_sec:.2f}_{end_sec:.2f}.mp4"


def angle_file_path(s3_key: str) -> Path:
    """Where a fully-downloaded angle file lives locally (the 'local game' source)."""
    dst = config.CLIP_CACHE / _cache_name(s3_key)
    return dst if dst.suffix else dst.with_suffix(".mp4")


def _local_source(s3_key: str) -> Path | None:
    """Return the local full angle file if it's already on disk, else None.
    Its presence is what makes a game a fast 'local game' (slice from disk, no S3)."""
    p = angle_file_path(s3_key)
    return p if (p.exists() and p.stat().st_size > 0) else None


def presigned_url(s3_key: str, expires: int | None = None) -> str:
    """Time-limited GET URL for the S3 object (no public ACL needed)."""
    import boto3  # noqa: PLC0415

    s3 = boto3.client("s3", region_name=config.S3_REGION)
    return s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": config.S3_BUCKET, "Key": s3_key},
        ExpiresIn=expires or config.S3_PRESIGN_TTL,
    )


def _probe_ok(path: Path) -> bool:
    """True if ffprobe reads a positive duration — i.e. a finalized, playable mp4.
    Guards against serving/uploading a truncated clip from a killed/hung ffmpeg."""
    if not path.exists() or path.stat().st_size == 0:
        return False
    try:
        p = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=nw=1:nk=1", str(path)],
            capture_output=True, text=True, timeout=20,
        )
        return p.returncode == 0 and float(p.stdout.strip() or 0) > 0
    except (ValueError, OSError, subprocess.SubprocessError):
        return False


def _ffmpeg_slice(
    src: str, start_sec: float, end_sec: float, out: Path, vf: str, http: bool,
    timeout: float | None = None,
) -> None:
    """Re-encode [start,end] of `src` into `out` (720p, no audio, browser-safe).
    Raises TimeoutError on a hung remote read so the caller can fall back."""
    dur = float(end_sec) - float(start_sec)
    cmd = ["ffmpeg", "-nostdin", "-y"]
    if http:
        # Survive a flaky/slow link: auto-reconnect on dropped or mid-stream-broken
        # connections (S3 reads can IncompleteRead on a poor pipe) and on transient
        # 5xx, retrying for up to the slice timeout.
        cmd += [
            "-reconnect", "1", "-reconnect_streamed", "1",
            "-reconnect_on_network_error", "1", "-reconnect_on_http_error", "5xx",
            "-reconnect_delay_max", "10",
        ]
    # -ss BEFORE -i => fast input seek (range requests on a seekable http source).
    cmd += ["-ss", f"{float(start_sec):.3f}", "-i", src, "-t", f"{dur:.3f}"]
    if vf:
        cmd += ["-vf", vf]
    # Write to a UNIQUE temp file so concurrent slices never share an output path
    # (the +faststart second pass re-opens the file; a sibling unlinking it mid-pass
    # is what caused "Unable to re-open output file"). Atomic-rename on success.
    tmp = out.with_name(f".{out.stem}.{os.getpid()}.{threading.get_ident()}.part.mp4")
    # yuv420p => renders in every browser (yuvj/4:2:2/4:4:4 show black in Safari etc.);
    # +faststart => moov up front so the <video> can start without the whole file.
    cmd += ["-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
            "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(tmp)]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    except subprocess.TimeoutExpired as e:
        tmp.unlink(missing_ok=True)
        raise TimeoutError(f"ffmpeg slice exceeded {timeout}s") from e
    if proc.returncode != 0 or not _probe_ok(tmp):
        tmp.unlink(missing_ok=True)
        raise RuntimeError(f"ffmpeg produced no valid clip:\n{proc.stderr[-2000:]}")
    os.replace(tmp, out)  # atomic publish into the cache


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
    if _probe_ok(out):
        return out
    url = presigned_url(s3_key)
    _ffmpeg_slice(url, start_sec, end_sec, out, config.DEFAULT_VF if vf is None else vf,
                  http=True, timeout=config.REMOTE_SLICE_TIMEOUT)
    return out


def extract_clip(
    s3_key: str,
    start_sec: float,
    end_sec: float,
    vf: str | None = None,
    prefer_remote: bool | None = None,
) -> Path:
    """Produce a clip for [start,end]. Defaults to the ranged remote slice (downloads
    only the window's bytes). A genuine ranged FAILURE falls back to a one-time full
    download; a TIMEOUT (slow link) does not — downloading a multi-GB file would be
    far worse — it surfaces a clear error instead."""
    if end_sec <= start_sec:
        raise ValueError("end_sec must be > start_sec")
    out = _clip_path(s3_key, start_sec, end_sec)
    if _probe_ok(out):  # valid cached clip (re-slices if a prior attempt was truncated)
        return out

    # Serialize per-clip so duplicate requests (preview + narrate + re-renders) don't
    # run competing ffmpegs; the waiter returns the cache the winner produced.
    with _path_lock(out):
        if _probe_ok(out):
            return out

        # Local-first: if the whole angle file is already on disk (a "local game"),
        # slice from it instantly — no S3, fast on any connection.
        local = _local_source(s3_key)
        if local is not None:
            _ffmpeg_slice(str(local), start_sec, end_sec, out,
                          config.DEFAULT_VF if vf is None else vf, http=False)
            return out

        remote = config.PREFER_REMOTE_SLICE if prefer_remote is None else prefer_remote
        if remote:
            try:
                return extract_clip_remote(s3_key, start_sec, end_sec, vf)
            except TimeoutError as e:
                raise RuntimeError(
                    f"Clip slice timed out after {config.REMOTE_SLICE_TIMEOUT}s — the "
                    f"connection to S3 is slow. Pre-warm the clip cache (prewarm.py), or run "
                    f"the backend closer to the bucket (same AWS region)."
                ) from e
            except Exception as e:  # noqa: BLE001
                if not config.ALLOW_FULL_DOWNLOAD:
                    # Never silently pull a multi-GB file — that's hours on a slow link.
                    raise RuntimeError(
                        f"Ranged clip slice failed ({str(e).splitlines()[0]}). Full-angle "
                        f"download is disabled (it would fetch the whole multi-GB file). "
                        f"Pre-warm the cache or run closer to S3; set VLM_ALLOW_FULL_DOWNLOAD=1 "
                        f"to override."
                    ) from e
                print(f"[clips] remote ranged slice failed ({e}); downloading full angle file", flush=True)

        src = ensure_angle_cached(s3_key)
        _ffmpeg_slice(str(src), start_sec, end_sec, out, config.DEFAULT_VF if vf is None else vf, http=False)
        return out
