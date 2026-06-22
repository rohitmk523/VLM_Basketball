"""Download a game's full angle files locally so it becomes a fast 'local game'
(clips slice from disk, no S3 at demo time). Run this from a FAST network.

  python fetch_game.py --game 26bb5808-3925-435e-9f83-d4bebe03c5be
  python fetch_game.py --game <gid> --angles LEFT          # one angle only

Files land in the clip cache under the name the backend's local-first path expects,
so once downloaded, every play of the game renders/narrates instantly.
"""
from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from app import clips, config, supabase_client as sb  # noqa: E402


def _fmt_gb(n: float) -> str:
    return f"{n / 1e9:.2f}GB"


def download_angle(game_id: str, angle: str) -> bool:
    vm = sb.video_meta(game_id, angle)
    s3_key = vm["s3_key"]
    total = float(vm.get("file_size") or 0)
    dst = clips.angle_file_path(s3_key)
    if dst.exists() and dst.stat().st_size > 0:
        print(f"  [{angle}/{vm['kind']}] already local: {dst.name} ({_fmt_gb(dst.stat().st_size)})")
        return True

    import boto3  # noqa: PLC0415

    s3 = boto3.client("s3", region_name=config.S3_REGION)
    tmp = dst.with_suffix(dst.suffix + ".part")
    dst.parent.mkdir(parents=True, exist_ok=True)
    print(f"  [{angle}/{vm['kind']}] downloading {s3_key}  ({_fmt_gb(total)})")
    done = [0]
    t0 = time.time()

    def cb(n: int) -> None:
        done[0] += n
        dt = max(time.time() - t0, 0.1)
        mbps = done[0] / 1e6 / dt
        pct = (done[0] / total * 100) if total else 0
        eta = (total - done[0]) / 1e6 / mbps if (total and mbps > 0) else 0
        print(f"\r    {_fmt_gb(done[0])}/{_fmt_gb(total)}  {pct:4.0f}%  {mbps:6.1f} MB/s  ETA {eta:4.0f}s",
              end="", flush=True)

    try:
        s3.download_file(config.S3_BUCKET, s3_key, str(tmp), Callback=cb)
    except Exception as e:  # noqa: BLE001
        tmp.unlink(missing_ok=True)
        print(f"\n  [{angle}] FAILED: {e}")
        return False
    tmp.replace(dst)
    print(f"\n  [{angle}] done -> {dst.name} in {time.time() - t0:.0f}s")
    return True


def main() -> int:
    ap = argparse.ArgumentParser(description="Download a game's angle files for local-first slicing.")
    ap.add_argument("--game", required=True, help="game_id (uuid)")
    ap.add_argument("--angles", default="LEFT,RIGHT", help="comma list (default LEFT,RIGHT)")
    args = ap.parse_args()

    angles = [a.strip().upper() for a in args.angles.split(",") if a.strip()]
    print(f"game {args.game}: fetching angles {angles}")
    ok = True
    for a in angles:
        try:
            ok = download_angle(args.game, a) and ok
        except Exception as e:  # noqa: BLE001
            print(f"  [{a}] error: {e}")
            ok = False
    print("\nDONE — restart the backend (./dev.sh) so local-first slicing picks these up."
          if ok else "\nCOMPLETED WITH ERRORS (see above).")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
