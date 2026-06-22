/** Format a seconds value (number) as m:ss, tolerating undefined/NaN. */
export function formatTime(seconds: number | undefined | null): string {
  if (seconds == null || !Number.isFinite(seconds)) return '—'
  const total = Math.max(0, Math.round(seconds))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

/** Format a start/end pair as "0:05 → 0:12 (7s)". */
export function formatRange(start?: number, end?: number): string {
  const a = formatTime(start)
  const b = formatTime(end)
  if (
    typeof start === 'number' &&
    typeof end === 'number' &&
    Number.isFinite(start) &&
    Number.isFinite(end)
  ) {
    const dur = Math.max(0, end - start)
    return `${a} → ${b} (${dur.toFixed(dur < 10 ? 1 : 0)}s)`
  }
  return `${a} → ${b}`
}
