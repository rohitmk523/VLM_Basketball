import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  JsonValue,
  MediaResolution,
  ModelChoice,
  NarrateResponse,
} from '../types'
import { ApiError, narratePlay } from '../lib/api'
import { ClassificationBadge } from './Badge'
import { Spinner } from './Spinner'
import { NarrationResult } from './NarrationResult'

/** One play queued for the recording reel. Narration runs LIVE in Present. */
export interface ReelItem {
  playId: string
  classification: string
  note: string
  angle: string
  clipUrl: string
  events?: JsonValue
  model: ModelChoice
  fps: number
  mediaResolution: MediaResolution
  useEvents: boolean
}

type NarrState = {
  status: 'idle' | 'narrating' | 'done' | 'error'
  result?: NarrateResponse
  elapsed?: number
  error?: string
}

function eventsSummary(events?: JsonValue): string {
  if (!Array.isArray(events)) return ''
  return events
    .map((e) => {
      if (e && typeof e === 'object' && !Array.isArray(e)) {
        const o = e as Record<string, unknown>
        return [o.label, o.playerA].filter(Boolean).join(' · ')
      }
      return ''
    })
    .filter(Boolean)
    .join('   |   ')
}

interface PresentationModeProps {
  items: ReelItem[]
  apiKey: string
  onExit: () => void
}

export function PresentationMode({ items, apiKey, onExit }: PresentationModeProps) {
  const [phase, setPhase] = useState<'narrate' | 'playback'>('narrate')
  const [idx, setIdx] = useState(0)
  const [byPlay, setByPlay] = useState<Record<string, NarrState>>({})
  const [, setTick] = useState(0) // drives the live timer re-render
  const startRef = useRef(0)
  const timerRef = useRef<number | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const rowRefs = useRef<Array<HTMLDivElement | null>>([])

  const current = items[idx]
  const cur: NarrState = (current && byPlay[current.playId]) || { status: 'idle' }
  const allNarrated =
    items.length > 0 && items.every((it) => byPlay[it.playId]?.status === 'done')

  useEffect(() => {
    rowRefs.current[idx]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [idx, phase])

  const stopTimer = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  const runNarrate = useCallback(
    async (item: ReelItem) => {
      abortRef.current?.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl
      setByPlay((p) => ({ ...p, [item.playId]: { status: 'narrating' } }))
      startRef.current = Date.now()
      stopTimer()
      timerRef.current = window.setInterval(() => setTick((t) => t + 1), 100)
      try {
        const res = await narratePlay(
          {
            play_id: item.playId,
            model: item.model,
            fps: item.fps,
            media_resolution: item.mediaResolution,
            use_events: item.useEvents,
            api_key: apiKey,
          },
          ctrl.signal,
        )
        if (ctrl.signal.aborted) return
        const elapsed = (Date.now() - startRef.current) / 1000
        setByPlay((p) => ({ ...p, [item.playId]: { status: 'done', result: res, elapsed } }))
      } catch (err) {
        if (ctrl.signal.aborted) return
        const msg =
          err instanceof ApiError || err instanceof Error ? err.message : 'Narration failed'
        setByPlay((p) => ({ ...p, [item.playId]: { status: 'error', error: msg } }))
      } finally {
        stopTimer()
      }
    },
    [apiKey],
  )

  useEffect(
    () => () => {
      abortRef.current?.abort()
      if (timerRef.current) window.clearInterval(timerRef.current)
    },
    [],
  )

  const navigate = useCallback(
    (next: number) => {
      if (cur.status === 'narrating') return
      setIdx((i) => Math.min(Math.max(i + next, 0), items.length - 1))
    },
    [cur.status, items.length],
  )

  const startPlayback = () => {
    setPhase('playback')
    setIdx(0)
  }

  const advancePlayback = () => {
    setIdx((i) => (i < items.length - 1 ? i + 1 : i))
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onExit()
      else if (phase === 'narrate' && e.key === 'ArrowRight') navigate(1)
      else if (phase === 'narrate' && e.key === 'ArrowLeft') navigate(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onExit, navigate, phase])

  if (!current) return null
  const liveElapsed =
    cur.status === 'narrating' ? (Date.now() - startRef.current) / 1000 : cur.elapsed ?? 0
  const cvInput = eventsSummary(current.events)

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ink-950">
      {/* top bar */}
      <div className="flex items-center justify-between border-b border-ink-800 px-5 py-2.5">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-brand-500 to-accent-600 text-sm font-bold text-white">
            u
          </div>
          <span className="text-sm font-semibold text-slate-100">uball · VLM Play-by-Play</span>
          <span className="text-xs text-slate-500">
            {phase === 'playback' ? 'Playing' : 'Play'} {idx + 1} of {items.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {phase === 'narrate' ? (
            <>
              <button type="button" onClick={() => navigate(-1)} disabled={idx === 0 || cur.status === 'narrating'}
                className="rounded-md border border-ink-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-ink-800 disabled:opacity-30">
                ← Prev
              </button>
              <button type="button" onClick={() => navigate(1)} disabled={idx === items.length - 1 || cur.status === 'narrating'}
                className="rounded-md border border-ink-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-ink-800 disabled:opacity-30">
                Next →
              </button>
              <button type="button" onClick={startPlayback} disabled={!allNarrated}
                title={allNarrated ? '' : 'Narrate all plays first'}
                className="btn btn-primary px-4 py-1.5 text-xs disabled:opacity-40">
                ▶ Play video with play-by-play
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => setIdx(0)}
                className="rounded-md border border-ink-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-ink-800">
                Restart
              </button>
              <button type="button" onClick={() => setPhase('narrate')}
                className="rounded-md border border-ink-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-ink-800">
                ← Narrate
              </button>
            </>
          )}
          <button type="button" onClick={onExit}
            className="rounded-md border border-ink-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-ink-800">
            Exit
          </button>
        </div>
      </div>

      <div className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[72%_28%]">
        {/* left: video (no caption bar) */}
        <div className="flex items-center justify-center bg-black p-4">
          <video
            key={`${phase}-${current.playId}`}
            src={current.clipUrl}
            autoPlay
            muted
            loop={phase === 'narrate'}
            playsInline
            onEnded={phase === 'playback' ? advancePlayback : undefined}
            className="max-h-full max-w-full rounded-lg"
          />
        </div>

        {/* right panel */}
        <div className="flex flex-col overflow-hidden border-l border-ink-800 bg-ink-900">
          {phase === 'narrate' ? (
            <>
              <div className="border-b border-ink-800 p-4">
                {cvInput && (
                  <p className="mb-2 text-[11px] text-slate-500">
                    <span className="font-semibold uppercase tracking-wide text-slate-400">CV input</span>{' '}
                    <span className="text-slate-600">(Supabase)</span> · {cvInput}
                  </p>
                )}
                {cur.status === 'idle' && (
                  <button type="button" onClick={() => runNarrate(current)} className="btn btn-primary w-full justify-center py-2.5">
                    ⚡ Narrate
                  </button>
                )}
                {cur.status === 'narrating' && (
                  <div className="flex items-center justify-between rounded-lg border border-brand-500/40 bg-brand-500/10 px-3 py-2.5">
                    <span className="flex items-center gap-2 text-sm text-brand-200">
                      <Spinner className="h-4 w-4" /> Narrating…
                    </span>
                    <span className="font-mono text-sm tabular-nums text-brand-200">{liveElapsed.toFixed(1)}s</span>
                  </div>
                )}
                {cur.status === 'error' && (
                  <div className="rounded-lg border border-red-600/40 bg-red-600/10 px-3 py-2 text-sm text-red-300">
                    {cur.error}
                    <button type="button" onClick={() => runNarrate(current)} className="ml-2 underline">retry</button>
                  </div>
                )}
                {cur.status === 'done' && (
                  <button type="button" onClick={() => runNarrate(current)} className="text-xs text-slate-500 hover:text-slate-300">
                    Re-narrate
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {cur.status === 'done' && cur.result && (
                  <NarrationResult result={cur.result} elapsedSeconds={cur.elapsed ?? null} />
                )}

                <p className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Reel</p>
                <div className="space-y-1.5">
                  {items.map((it, i) => (
                    <div key={it.playId}
                      className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs ${
                        i === idx ? 'border-brand-500 bg-brand-500/10 text-slate-200' : 'border-ink-800 bg-ink-850 text-slate-500'
                      }`}>
                      <span>{i + 1}</span>
                      <ClassificationBadge label={it.classification} />
                      <span className="ml-auto text-[10px]">
                        {byPlay[it.playId]?.status === 'done' ? '✓' : byPlay[it.playId]?.status === 'narrating' ? '…' : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            /* playback: each play's box lights up while its clip plays */
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-3">
                {items.map((it, i) => {
                  const st = byPlay[it.playId]
                  const active = i === idx
                  return (
                    <div
                      key={it.playId}
                      ref={(el) => (rowRefs.current[i] = el)}
                      className={`rounded-lg border p-3 transition-all duration-300 ${
                        active
                          ? 'border-brand-500 bg-brand-500/10 shadow-[0_0_0_1px_rgba(99,102,241,0.4)]'
                          : 'border-ink-800 bg-ink-850 opacity-40'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-500">{i + 1}</span>
                        <ClassificationBadge label={it.classification} />
                      </div>
                      {active && st?.result ? (
                        <div className="mt-2">
                          <NarrationResult result={st.result} elapsedSeconds={st.elapsed ?? null} />
                        </div>
                      ) : (
                        st?.result?.narration.summary && (
                          <p className="mt-1.5 text-sm text-slate-400">{st.result.narration.summary}</p>
                        )
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
