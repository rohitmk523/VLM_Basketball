import { useCallback, useEffect, useState } from 'react'
import type { Settings } from '../types'
import { loadSettings, saveSettings } from './storage'

export interface UseSettings {
  settings: Settings
  update: (patch: Partial<Settings>) => void
  reset: () => void
}

/** Settings state backed by localStorage; persists on every change. */
export function useSettings(): UseSettings {
  const [settings, setSettings] = useState<Settings>(() => loadSettings())

  useEffect(() => {
    saveSettings(settings)
  }, [settings])

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...patch }))
  }, [])

  const reset = useCallback(() => {
    setSettings(loadSettings())
  }, [])

  return { settings, update, reset }
}
