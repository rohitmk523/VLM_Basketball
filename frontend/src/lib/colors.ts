// Map common jersey color names (and bare hex strings) to a hex value.
// Falls back to a neutral gray for anything unrecognized.

const COLOR_MAP: Record<string, string> = {
  red: '#ef4444',
  crimson: '#dc143c',
  maroon: '#7f1d1d',
  orange: '#f97316',
  amber: '#f59e0b',
  gold: '#eab308',
  yellow: '#facc15',
  lime: '#84cc16',
  green: '#22c55e',
  emerald: '#10b981',
  teal: '#14b8a6',
  cyan: '#06b6d4',
  sky: '#0ea5e9',
  blue: '#3b82f6',
  navy: '#1e3a8a',
  royal: '#1d4ed8',
  indigo: '#6366f1',
  violet: '#8b5cf6',
  purple: '#a855f7',
  magenta: '#d946ef',
  pink: '#ec4899',
  rose: '#f43f5e',
  brown: '#92400e',
  tan: '#d2b48c',
  beige: '#e8dcc0',
  white: '#f8fafc',
  silver: '#cbd5e1',
  gray: '#9ca3af',
  grey: '#9ca3af',
  black: '#1f2937',
}

const FALLBACK = '#6b7280'

/**
 * Resolve a team color string to a hex code.
 * Accepts named colors ("red", "Royal Blue"), bare hex ("#ff0000", "ff0000"),
 * or anything else (falls back to gray).
 */
export function resolveColor(input: string | null | undefined): string {
  if (!input) return FALLBACK
  const raw = input.trim().toLowerCase()
  if (!raw) return FALLBACK

  // Explicit hex (with or without #).
  const hexMatch = raw.match(/^#?([0-9a-f]{6}|[0-9a-f]{3})$/)
  if (hexMatch) {
    return raw.startsWith('#') ? raw : `#${raw}`
  }

  // Direct name match.
  if (COLOR_MAP[raw]) return COLOR_MAP[raw]

  // Multi-word names ("royal blue", "dark green") — pick the last known token.
  const tokens = raw.split(/[\s_-]+/)
  for (let i = tokens.length - 1; i >= 0; i--) {
    const t = tokens[i]
    if (COLOR_MAP[t]) return COLOR_MAP[t]
  }

  return FALLBACK
}

/** True if the resolved color is light enough to need a dark border/text. */
export function isLightColor(hex: string): boolean {
  const m = hex.replace('#', '')
  if (m.length !== 6) return false
  const r = parseInt(m.slice(0, 2), 16)
  const g = parseInt(m.slice(2, 4), 16)
  const b = parseInt(m.slice(4, 6), 16)
  // Perceived luminance.
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum > 0.7
}
