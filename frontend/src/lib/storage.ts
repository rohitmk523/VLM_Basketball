import type { Settings } from '../types'

const STORAGE_KEY = 'uball.vlm.settings.v1'

export const DEFAULT_SETTINGS: Settings = {
  apiKey: '',
  defaultModel: 'flash',
  fps: 5,
  mediaResolution: 'medium',
}

/**
 * Load settings from localStorage, merging over defaults so missing/renamed
 * fields never crash the UI. Never throws.
 */
export function loadSettings(): Settings {
  if (typeof window === 'undefined') return { ...DEFAULT_SETTINGS }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    const parsed = JSON.parse(raw) as Partial<Settings>
    return {
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : DEFAULT_SETTINGS.apiKey,
      defaultModel:
        parsed.defaultModel === 'pro' || parsed.defaultModel === 'flash'
          ? parsed.defaultModel
          : DEFAULT_SETTINGS.defaultModel,
      fps:
        typeof parsed.fps === 'number' && Number.isFinite(parsed.fps) && parsed.fps > 0
          ? parsed.fps
          : DEFAULT_SETTINGS.fps,
      mediaResolution:
        parsed.mediaResolution === 'low' ||
        parsed.mediaResolution === 'medium' ||
        parsed.mediaResolution === 'high'
          ? parsed.mediaResolution
          : DEFAULT_SETTINGS.mediaResolution,
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

/** Persist settings to localStorage. Never throws. */
export function saveSettings(settings: Settings): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Storage may be unavailable (private mode, quota). Fail silently.
  }
}
