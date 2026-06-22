import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { MediaResolution, ModelChoice, NarrateResponse, Settings } from '../types'
import { ApiError, narrateManual } from '../lib/api'
import { ErrorBanner } from './ErrorBanner'
import { NarrationControls } from './NarrationControls'
import { NarrationResult } from './NarrationResult'
import { NarrationLoading } from './NarrationLoading'
import { Spinner } from './Spinner'
import { SparkIcon, UploadIcon } from './icons'

interface ManualModeProps {
  settings: Settings
  onOpenSettings: () => void
}

function errMsg(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error) return err.message
  return fallback
}

/** Validate a JSON string; returns an error message or null when valid/empty. */
function jsonError(raw: string): string | null {
  if (!raw.trim()) return null
  try {
    JSON.parse(raw)
    return null
  } catch (e) {
    return e instanceof Error ? e.message : 'Invalid JSON'
  }
}

export function ManualMode({ settings, onOpenSettings }: ManualModeProps) {
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [eventsText, setEventsText] = useState('')
  const [contextText, setContextText] = useState('')

  const [model, setModel] = useState<ModelChoice>(settings.defaultModel)
  const [fps, setFps] = useState<number>(settings.fps)
  const [mediaResolution, setMediaResolution] = useState<MediaResolution>(
    settings.mediaResolution,
  )

  const [narrating, setNarrating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<NarrateResponse | null>(null)
  const [elapsed, setElapsed] = useState<number | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    setModel(settings.defaultModel)
    setFps(settings.fps)
    setMediaResolution(settings.mediaResolution)
  }, [settings.defaultModel, settings.fps, settings.mediaResolution])

  // Object URL lifecycle for the local video preview.
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  useEffect(() => () => abortRef.current?.abort(), [])

  const eventsErr = useMemo(() => jsonError(eventsText), [eventsText])
  const contextErr = useMemo(() => jsonError(contextText), [contextText])

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null
    setFile(f)
    setResult(null)
    setError(null)
  }

  const runNarrate = useCallback(async () => {
    if (!file) {
      setError('Choose a clip to upload first.')
      return
    }
    if (eventsErr) {
      setError(`Events JSON is invalid: ${eventsErr}`)
      return
    }
    if (contextErr) {
      setError(`Context JSON is invalid: ${contextErr}`)
      return
    }
    if (!settings.apiKey.trim()) {
      setError('Add your Gemini API key in Settings first.')
      onOpenSettings()
      return
    }

    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    setNarrating(true)
    setError(null)
    setResult(null)
    setElapsed(null)
    const startedAt = Date.now()

    try {
      const res = await narrateManual(
        {
          file,
          model,
          fps,
          mediaResolution,
          events: eventsText,
          context: contextText,
          apiKey: settings.apiKey.trim(),
        },
        ctrl.signal,
      )
      if (ctrl.signal.aborted) return
      setResult(res)
      setElapsed((Date.now() - startedAt) / 1000)
    } catch (err) {
      if (ctrl.signal.aborted) return
      setError(errMsg(err, 'Narration failed'))
    } finally {
      if (!ctrl.signal.aborted) setNarrating(false)
    }
  }, [
    file,
    eventsErr,
    contextErr,
    settings.apiKey,
    model,
    fps,
    mediaResolution,
    eventsText,
    contextText,
    onOpenSettings,
  ])

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      {/* Inputs */}
      <div className="space-y-4">
        <div className="card space-y-3 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Clip</p>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-ink-600 bg-ink-900 px-4 py-8 text-center transition-colors hover:border-accent-500 hover:bg-ink-850">
            <UploadIcon className="h-6 w-6 text-slate-500" />
            <span className="text-sm text-slate-300">
              {file ? file.name : 'Click to choose a video clip (mp4, mov…)'}
            </span>
            {file && (
              <span className="text-[11px] text-slate-500">
                {(file.size / (1024 * 1024)).toFixed(1)} MB
              </span>
            )}
            <input
              type="file"
              accept="video/*"
              className="hidden"
              onChange={onPickFile}
            />
          </label>

          {previewUrl && (
            <video
              key={previewUrl}
              src={previewUrl}
              controls
              playsInline
              preload="metadata"
              className="aspect-video w-full rounded-lg bg-black"
            />
          )}
        </div>

        <div className="card space-y-3 p-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
              Events JSON <span className="font-normal normal-case text-slate-500">(optional)</span>
            </label>
            <textarea
              value={eventsText}
              onChange={(e) => setEventsText(e.target.value)}
              placeholder='{"events": [...]}'
              rows={6}
              spellCheck={false}
              className="input font-mono text-[12px]"
            />
            {eventsErr && <p className="mt-1 text-[11px] text-red-400">Invalid JSON: {eventsErr}</p>}
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
              Context JSON{' '}
              <span className="font-normal normal-case text-slate-500">(optional)</span>
            </label>
            <textarea
              value={contextText}
              onChange={(e) => setContextText(e.target.value)}
              placeholder='{"teams": {...}}'
              rows={4}
              spellCheck={false}
              className="input font-mono text-[12px]"
            />
            {contextErr && (
              <p className="mt-1 text-[11px] text-red-400">Invalid JSON: {contextErr}</p>
            )}
          </div>
        </div>

        <div className="card space-y-4 p-4">
          <NarrationControls
            model={model}
            fps={fps}
            mediaResolution={mediaResolution}
            onModel={setModel}
            onFps={setFps}
            onMediaResolution={setMediaResolution}
            disabled={narrating}
          />
          <button
            type="button"
            onClick={runNarrate}
            disabled={narrating || !file}
            className="btn btn-primary w-full py-2.5"
          >
            {narrating ? <Spinner className="h-4 w-4" /> : <SparkIcon className="h-4 w-4" />}
            {narrating ? 'Narrating…' : 'Narrate'}
          </button>
          <ErrorBanner message={error} onDismiss={() => setError(null)} />
        </div>
      </div>

      {/* Output */}
      <div className="space-y-4">
        {narrating ? (
          <div className="card p-4">
            <NarrationLoading />
          </div>
        ) : result ? (
          <div className="card p-4">
            <NarrationResult result={result} elapsedSeconds={elapsed} />
          </div>
        ) : (
          <div className="card flex min-h-[300px] flex-col items-center justify-center gap-2 p-8 text-center">
            <SparkIcon className="h-8 w-8 text-slate-600" />
            <p className="text-sm text-slate-400">
              Upload a clip (and optionally paste events/context JSON), then run Narrate.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
