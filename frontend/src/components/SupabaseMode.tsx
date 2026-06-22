import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  Game,
  MediaResolution,
  ModelChoice,
  NarrateResponse,
  Play,
  PlayDetail,
  Settings,
} from '../types'
import {
  ApiError,
  clipUrl,
  getGames,
  getPlay,
  getPlays,
  narratePlay,
} from '../lib/api'
import { formatRange } from '../lib/format'
import { ColorSwatch } from './ColorSwatch'
import { Badge, ClassificationBadge } from './Badge'
import { ErrorBanner } from './ErrorBanner'
import { JsonViewer } from './JsonViewer'
import { Toggle } from './Toggle'
import { NarrationControls } from './NarrationControls'
import { NarrationResult } from './NarrationResult'
import { NarrationLoading } from './NarrationLoading'
import { CostPanel } from './CostPanel'
import { Spinner } from './Spinner'
import { SparkIcon } from './icons'

interface SupabaseModeProps {
  settings: Settings
  onOpenSettings: () => void
}

function errMsg(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error) return err.message
  return fallback
}

export function SupabaseMode({ settings, onOpenSettings }: SupabaseModeProps) {
  // Games
  const [games, setGames] = useState<Game[]>([])
  const [gamesLoading, setGamesLoading] = useState(true)
  const [gamesError, setGamesError] = useState<string | null>(null)
  const [selectedGameId, setSelectedGameId] = useState<string>('')

  // Plays
  const [plays, setPlays] = useState<Play[]>([])
  const [playsLoading, setPlaysLoading] = useState(false)
  const [playsError, setPlaysError] = useState<string | null>(null)
  const [selectedPlayId, setSelectedPlayId] = useState<string>('')

  // Play detail
  const [detail, setDetail] = useState<PlayDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  // Narration request controls
  const [model, setModel] = useState<ModelChoice>(settings.defaultModel)
  const [fps, setFps] = useState<number>(settings.fps)
  const [mediaResolution, setMediaResolution] = useState<MediaResolution>(
    settings.mediaResolution,
  )
  const [useEvents, setUseEvents] = useState(true)

  // Narration result
  const [narrating, setNarrating] = useState(false)
  const [narrateError, setNarrateError] = useState<string | null>(null)
  const [result, setResult] = useState<NarrateResponse | null>(null)
  const [elapsed, setElapsed] = useState<number | null>(null)
  const narrateAbort = useRef<AbortController | null>(null)

  // Sync request controls to settings whenever settings change (e.g. after first load).
  useEffect(() => {
    setModel(settings.defaultModel)
    setFps(settings.fps)
    setMediaResolution(settings.mediaResolution)
  }, [settings.defaultModel, settings.fps, settings.mediaResolution])

  // Load games once.
  useEffect(() => {
    const ctrl = new AbortController()
    setGamesLoading(true)
    setGamesError(null)
    getGames(ctrl.signal)
      .then((res) => {
        setGames(res.games ?? [])
      })
      .catch((err) => {
        if (ctrl.signal.aborted) return
        setGamesError(errMsg(err, 'Failed to load games'))
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setGamesLoading(false)
      })
    return () => ctrl.abort()
  }, [])

  // Load plays when a game is selected.
  useEffect(() => {
    if (!selectedGameId) {
      setPlays([])
      setSelectedPlayId('')
      return
    }
    const ctrl = new AbortController()
    setPlaysLoading(true)
    setPlaysError(null)
    setSelectedPlayId('')
    setPlays([])
    getPlays(selectedGameId, ctrl.signal)
      .then((res) => setPlays(res.plays ?? []))
      .catch((err) => {
        if (ctrl.signal.aborted) return
        setPlaysError(errMsg(err, 'Failed to load plays'))
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setPlaysLoading(false)
      })
    return () => ctrl.abort()
  }, [selectedGameId])

  // Load play detail when a play is selected.
  useEffect(() => {
    if (!selectedPlayId) {
      setDetail(null)
      return
    }
    const ctrl = new AbortController()
    setDetailLoading(true)
    setDetailError(null)
    setDetail(null)
    setResult(null)
    setNarrateError(null)
    getPlay(selectedPlayId, ctrl.signal)
      .then((res) => setDetail(res))
      .catch((err) => {
        if (ctrl.signal.aborted) return
        setDetailError(errMsg(err, 'Failed to load play detail'))
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setDetailLoading(false)
      })
    return () => ctrl.abort()
  }, [selectedPlayId])

  const selectedGame = games.find((g) => g.game_id === selectedGameId) ?? null

  const runNarrate = useCallback(async () => {
    if (!selectedPlayId) return
    if (!settings.apiKey.trim()) {
      setNarrateError('Add your Gemini API key in Settings first.')
      onOpenSettings()
      return
    }
    narrateAbort.current?.abort()
    const ctrl = new AbortController()
    narrateAbort.current = ctrl

    setNarrating(true)
    setNarrateError(null)
    setResult(null)
    setElapsed(null)
    const startedAt = Date.now()

    try {
      const res = await narratePlay(
        {
          play_id: selectedPlayId,
          model,
          fps,
          media_resolution: mediaResolution,
          use_events: useEvents,
          api_key: settings.apiKey.trim(),
        },
        ctrl.signal,
      )
      if (ctrl.signal.aborted) return
      setResult(res)
      setElapsed((Date.now() - startedAt) / 1000)
    } catch (err) {
      if (ctrl.signal.aborted) return
      setNarrateError(errMsg(err, 'Narration failed'))
    } finally {
      if (!ctrl.signal.aborted) setNarrating(false)
    }
  }, [
    selectedPlayId,
    settings.apiKey,
    model,
    fps,
    mediaResolution,
    useEvents,
    onOpenSettings,
  ])

  // Cancel any in-flight narration on unmount.
  useEffect(() => () => narrateAbort.current?.abort(), [])

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
      {/* Left: game + plays selector */}
      <div className="space-y-4">
        <div className="card p-4">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-400">
            Game
          </label>
          {gamesLoading ? (
            <div className="flex items-center gap-2 py-2 text-sm text-slate-400">
              <Spinner /> Loading games…
            </div>
          ) : (
            <>
              <select
                className="input"
                value={selectedGameId}
                onChange={(e) => setSelectedGameId(e.target.value)}
              >
                <option value="">Select a game…</option>
                {games.map((g) => (
                  <option key={g.game_id} value={g.game_id}>
                    {g.local ? '● ' : ''}{g.label} · {g.date}
                  </option>
                ))}
              </select>
              {selectedGame && (
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <ColorSwatch color={selectedGame.team1.color} />
                    {selectedGame.team1.name}
                  </span>
                  <span className="text-slate-600">vs</span>
                  <span className="flex items-center gap-1.5">
                    <ColorSwatch color={selectedGame.team2.color} />
                    {selectedGame.team2.name}
                  </span>
                  {selectedGame.local && (
                    <span className="rounded border border-emerald-600/40 bg-emerald-600/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                      ● LOCAL · instant
                    </span>
                  )}
                </div>
              )}
            </>
          )}
          <ErrorBanner
            message={gamesError}
            onDismiss={() => setGamesError(null)}
            className="mt-3"
          />
        </div>

        <div className="card flex max-h-[60vh] flex-col p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Plays
            </span>
            {plays.length > 0 && (
              <span className="text-[11px] text-slate-500">{plays.length}</span>
            )}
          </div>

          {!selectedGameId ? (
            <p className="py-6 text-center text-sm text-slate-500">
              Pick a game to see its plays.
            </p>
          ) : playsLoading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-slate-400">
              <Spinner /> Loading plays…
            </div>
          ) : plays.length === 0 && !playsError ? (
            <p className="py-6 text-center text-sm text-slate-500">No plays for this game.</p>
          ) : (
            <ul className="-mr-1 space-y-2 overflow-y-auto pr-1">
              {plays.map((p) => {
                const active = p.play_id === selectedPlayId
                return (
                  <li key={p.play_id}>
                    <button
                      type="button"
                      onClick={() => setSelectedPlayId(p.play_id)}
                      className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors ${
                        active
                          ? 'border-brand-500 bg-brand-500/10'
                          : 'border-ink-700 bg-ink-850 hover:bg-ink-800'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <ClassificationBadge label={p.classification} />
                        {p.angle && <Badge label={p.angle} tone="neutral" />}
                      </div>
                      {p.note && (
                        <p className="mt-1.5 line-clamp-2 text-sm text-slate-200">{p.note}</p>
                      )}
                      <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
                        <span className="font-mono">{formatRange(p.start, p.end)}</span>
                        {(p.player_a || p.player_b) && (
                          <span>
                            · {[p.player_a, p.player_b].filter(Boolean).join(' / ')}
                          </span>
                        )}
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          <ErrorBanner
            message={playsError}
            onDismiss={() => setPlaysError(null)}
            className="mt-3"
          />
        </div>
      </div>

      {/* Right: clip + events + narration */}
      <div className="space-y-4">
        {!selectedPlayId ? (
          <div className="card flex min-h-[300px] flex-col items-center justify-center gap-2 p-8 text-center">
            <SparkIcon className="h-8 w-8 text-slate-600" />
            <p className="text-sm text-slate-400">
              Select a play to view its clip, structured events, and run a narration.
            </p>
          </div>
        ) : detailLoading ? (
          <div className="card flex min-h-[300px] items-center justify-center gap-2 p-8">
            <Spinner className="h-5 w-5 text-slate-400" />
            <span className="text-sm text-slate-400">Loading play…</span>
          </div>
        ) : (
          <>
            <ErrorBanner message={detailError} onDismiss={() => setDetailError(null)} />

            {/* Clip */}
            <div className="card overflow-hidden p-0">
              <div className="border-b border-ink-700 bg-ink-850 px-4 py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  {detail && <ClassificationBadge label={detail.classification} />}
                  {detail?.angle && <Badge label={detail.angle} tone="neutral" />}
                  {detail && (
                    <span className="font-mono text-[11px] text-slate-500">
                      {formatRange(detail.start, detail.end)}
                    </span>
                  )}
                </div>
                {detail?.note && (
                  <p className="mt-1.5 text-sm text-slate-300">{detail.note}</p>
                )}
              </div>
              <div className="bg-black">
                {/* keyed so the video element reloads when the play changes */}
                <video
                  key={selectedPlayId}
                  src={clipUrl(selectedPlayId)}
                  controls
                  playsInline
                  preload="metadata"
                  className="aspect-video max-h-[60vh] w-full bg-black"
                />
              </div>
            </div>

            {/* Events + context */}
            {detail && (
              <div className="card space-y-3 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Structured output (CV)
                </p>
                <JsonViewer value={detail.events} title="events" defaultOpen maxHeight={280} />
                <JsonViewer
                  value={detail.context}
                  title="context"
                  defaultOpen={false}
                  maxHeight={220}
                />
              </div>
            )}

            {/* Narration controls */}
            <div className="card space-y-4 p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex-1">
                  <NarrationControls
                    model={model}
                    fps={fps}
                    mediaResolution={mediaResolution}
                    onModel={setModel}
                    onFps={setFps}
                    onMediaResolution={setMediaResolution}
                    disabled={narrating}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t border-ink-700 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <Toggle
                  checked={useEvents}
                  onChange={setUseEvents}
                  disabled={narrating}
                  label="Use events (CV-grounded)"
                  description="Feed the structured CV output to the model"
                />
                <button
                  type="button"
                  onClick={runNarrate}
                  disabled={narrating || !selectedPlayId}
                  className="btn btn-primary px-5 py-2.5"
                >
                  {narrating ? <Spinner className="h-4 w-4" /> : <SparkIcon className="h-4 w-4" />}
                  {narrating ? 'Narrating…' : 'Narrate'}
                </button>
              </div>

              <ErrorBanner
                message={narrateError}
                onDismiss={() => setNarrateError(null)}
              />
            </div>

            {/* Narration result / loading. When a result is in, the exact clip the
                model saw sits beside its output for a direct video-vs-narration check. */}
            {(narrating || result) && (
              <div className="card p-4">
                {narrating ? (
                  <NarrationLoading />
                ) : (
                  result && (
                    <div className="space-y-5">
                      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                        <div className="space-y-2 xl:sticky xl:top-4 xl:self-start">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                            Clip the model saw
                          </p>
                          <video
                            key={`result-${selectedPlayId}`}
                            src={clipUrl(selectedPlayId)}
                            controls
                            autoPlay
                            muted
                            loop
                            playsInline
                            preload="metadata"
                            className="aspect-video w-full rounded-lg bg-black"
                          />
                          {result.clip_source && (
                            <p className="font-mono text-[11px] text-slate-500">
                              {result.clip_source.kind}/{result.clip_source.angle} ·{' '}
                              {result.clip_source.start}–{result.clip_source.end}s ·{' '}
                              {result.clip_source.via === 's3_presigned_range'
                                ? 'S3 range (no full download)'
                                : result.clip_source.via}
                            </p>
                          )}
                        </div>
                        <NarrationResult result={result} elapsedSeconds={elapsed} />
                      </div>
                      <div className="border-t border-ink-700 pt-4">
                        <CostPanel
                          result={result}
                          elapsedSeconds={elapsed}
                          playsInGame={plays.length}
                        />
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
