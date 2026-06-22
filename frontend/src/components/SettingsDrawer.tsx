import { useState } from 'react'
import type { MediaResolution, ModelChoice, Settings } from '../types'
import { getModels, ApiError } from '../lib/api'
import { CloseIcon } from './icons'
import { Spinner } from './Spinner'

interface SettingsDrawerProps {
  open: boolean
  settings: Settings
  apiBase: string
  onClose: () => void
  onChange: (patch: Partial<Settings>) => void
}

type TestState =
  | { kind: 'idle' }
  | { kind: 'testing' }
  | { kind: 'ok'; count: number }
  | { kind: 'error'; message: string }

export function SettingsDrawer({
  open,
  settings,
  apiBase,
  onClose,
  onChange,
}: SettingsDrawerProps) {
  const [test, setTest] = useState<TestState>({ kind: 'idle' })

  const runTest = async () => {
    if (!settings.apiKey.trim()) {
      setTest({ kind: 'error', message: 'Enter a Gemini API key first.' })
      return
    }
    setTest({ kind: 'testing' })
    try {
      const res = await getModels(settings.apiKey.trim())
      setTest({ kind: 'ok', count: res.models?.length ?? 0 })
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Test failed'
      setTest({ kind: 'error', message })
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/60 transition-opacity ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <aside
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-ink-700 bg-ink-900 shadow-2xl transition-transform duration-300 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
      >
        <div className="flex items-center justify-between border-b border-ink-700 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-100">Settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-ink-700 hover:text-slate-200"
            aria-label="Close settings"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          {/* API key */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-200">Gemini API key</label>
            <input
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder="AIza…"
              value={settings.apiKey}
              onChange={(e) => {
                onChange({ apiKey: e.target.value })
                setTest({ kind: 'idle' })
              }}
              className="input font-mono"
            />
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={runTest}
                disabled={test.kind === 'testing'}
                className="btn btn-ghost px-3 py-1.5 text-xs"
              >
                {test.kind === 'testing' && <Spinner className="h-3.5 w-3.5" />}
                Test key
              </button>
              {test.kind === 'ok' && (
                <span className="text-xs text-emerald-400">
                  Valid · {test.count} model{test.count === 1 ? '' : 's'} available
                </span>
              )}
              {test.kind === 'error' && (
                <span className="break-words text-xs text-red-400">{test.message}</span>
              )}
            </div>
            <p className="text-[11px] leading-relaxed text-slate-500">
              Your key is stored only in this browser (localStorage) and is sent to the backend
              only when you run a narration or test the key. It never leaves your machine
              otherwise.
            </p>
          </div>

          {/* Default model */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-200">Default model</label>
            <div className="grid grid-cols-2 gap-2">
              {(['flash', 'pro'] as ModelChoice[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => onChange({ defaultModel: m })}
                  className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                    settings.defaultModel === m
                      ? 'border-brand-500 bg-brand-500/10 text-slate-100'
                      : 'border-ink-600 bg-ink-850 text-slate-300 hover:bg-ink-700'
                  }`}
                >
                  <span className="block font-medium capitalize">{m}</span>
                  <span className="block text-[11px] text-slate-500">
                    {m === 'flash' ? 'Gemini 3.5 Flash' : 'Gemini 3.1 Pro'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* FPS */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-200">Frames per second (FPS)</label>
            <input
              type="number"
              min={1}
              max={30}
              step={1}
              value={settings.fps}
              onChange={(e) => {
                const n = Number(e.target.value)
                onChange({ fps: Number.isFinite(n) && n > 0 ? n : 1 })
              }}
              className="input"
            />
            <p className="text-[11px] text-slate-500">
              How many frames per second the model samples from the clip.
            </p>
          </div>

          {/* Media resolution */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-200">Media resolution</label>
            <div className="grid grid-cols-3 gap-2">
              {(['low', 'medium', 'high'] as MediaResolution[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => onChange({ mediaResolution: r })}
                  className={`rounded-lg border px-3 py-2 text-sm capitalize transition-colors ${
                    settings.mediaResolution === r
                      ? 'border-accent-500 bg-accent-500/10 text-slate-100'
                      : 'border-ink-600 bg-ink-850 text-slate-300 hover:bg-ink-700'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-[11px] text-slate-500">
            Backend: <span className="font-mono text-slate-400">{apiBase}</span>
          </div>
        </div>
      </aside>
    </>
  )
}
