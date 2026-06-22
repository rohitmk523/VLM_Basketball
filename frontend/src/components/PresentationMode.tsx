import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  JsonValue,
  MediaResolution,
  ModelChoice,
  NarrateResponse,
  PlayByPlayItem,
} from '../types'
import { ApiError, narratePlay } from '../lib/api'
import { ClassificationBadge } from './Badge'
import { Spinner } from './Spinner'

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

const HIDDEN = new Set(['', 'none', 'unknown', 'n/a'])

function detailTags(it: PlayByPlayItem): string {
  return [
    it.shot_type,
    it.shot_qualifier,
    it.shooting_hand ? `${it.shooting_hand} hand` : '',
    it.court_location,
    it.contest,
    it.outcome,
  ]
    .map((v) => (v == null ? '' : String(v).trim()))
    .filter((v) => !HIDDEN.has(v.toLowerCase()))
    .map((v) => v.replace(/[-_]/g, ' '))
    .join('  ·  ')
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
  const [idx, setIdx] = useState(0)
  const [byPlay, setByPlay] = useState<Record<string, NarrState>>({})
  const [, setTick] = useState(0) // drives the live timer re-render
  const startRef = useRef(0)
  const timerRef = useRef<number | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const rowRefs = useRef<Array<HTMLDivElement | null>>([])

  const current = items[idx]
  const cur: NarrState = (current && byPlay[current.playId]) || { status: 'idle' }

  useEffect(() => {
    rowRefs.current[idx]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [idx])

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

  // Cleanup on unmount.
  useEffect(() => () => {
    abortRef.current?.abort()
    if (timerRef.current) window.clearInterval(timerRef.current)
  }, [])

  const navigate = useCallback(
    (next: number) => {
      if (cur.status === 'narrating') return // don't interrupt a live take
      setIdx((i) => Math.min(Math.max(i + next, 0), items.length - 1))
    },
    [cur.status, items.length],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onExit()
      else if (e.key === 'ArrowRight') navigate(1)
      else if (e.key === 'ArrowLeft') navigate(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onExit, navigate])

  if (!current) return null

  const liveElapsed =
    cur.status === 'narrating' ? (Date.now() - startRef.current) / 1000 : cur.elapsed ?? 0
  const tokens = cur.result?.usage?.total_tokens
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
          <span className="text-xs text-slate-500">Play {idx + 1} of {items.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => navigate(-1)} disabled={idx === 0 || cur.status === 'narrating'}
            className="rounded-md border border-ink-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-ink-800 disabled:opacity-30">
            ← Prev
          </button>
          <button type="button" onClick={() => navigate(1)} disabled={idx === items.length - 1 || cur.status === 'narrating'}
            className="rounded-md border border-ink-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-ink-800 disabled:opacity-30">
            Next →
          </button>
          <button type="button" onClick={onExit}
            className="rounded-md border border-ink-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-ink-800">
            Exit
          </button>
        </div>
      </div>

      <div className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[72%_28%]">
        {/* left: video */}
        <div className="flex flex-col bg-black">
          <div className="flex flex-1 items-center justify-center p-4">
            <video
              key={current.playId}
              src={current.clipUrl}
              autoPlay
              muted
              loop
              playsInline
              className="max-h-full max-w-full rounded-lg"
            />
          </div>
          <div className="border-t border-ink-800 bg-ink-950 px-5 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <ClassificationBadge label={current.classification} />
              {current.angle && <span className="text-xs text-slate-500">{current.angle}</span>}
            </div>
            {current.note && <p className="mt-1 text-sm text-slate-400">{current.note}</p>}
          </div>
        </div>

        {/* right: live narration panel */}
        <div className="flex flex-col overflow-hidden border-l border-ink-800 bg-ink-900">
          {/* current play — Narrate button + live stats */}
          <div className="border-b border-ink-800 p-4">
            {cvInput && (
              <p className="mb-2 text-[11px] text-slate-500">
                <span className="font-semibold uppercase tracking-wide text-slate-400">CV input</span>{' '}
                <span className="text-slate-600">(Supabase)</span> · {cvInput}
              </p>
            )}

            {cur.status === 'idle' && (
              <button
                type="button"
                onClick={() => runNarrate(current)}
                className="btn btn-primary w-full justify-center py-2.5"
              >
                ⚡ Narrate with Gemini
              </button>
            )}

            {cur.status === 'narrating' && (
              <div className="flex items-center justify-between rounded-lg border border-brand-500/40 bg-brand-500/10 px-3 py-2.5">
                <span className="flex items-center gap-2 text-sm text-brand-200">
                  <Spinner className="h-4 w-4" /> Narrating with Gemini · {current.model}…
                </span>
                <span className="font-mono text-sm tabular-nums text-brand-200">
                  {liveElapsed.toFixed(1)}s
                </span>
              </div>
            )}

            {cur.status === 'done' && cur.result && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md border border-emerald-600/40 bg-emerald-600/10 px-2 py-1 text-[11px] font-semibold text-emerald-300">
                  ✓ Generated by Google Gemini
                </span>
                <span className="chip"><span className="text-slate-500">model</span> {cur.result.model}</span>
                <span className="chip"><span className="text-slate-500">time</span> {(cur.elapsed ?? 0).toFixed(1)}s</span>
                {tokens != null && (
                  <span className="chip"><span className="text-slate-500">tokens</span> {tokens.toLocaleString()}</span>
                )}
                <span className={`chip ${current.useEvents ? 'border-emerald-600/40 text-emerald-300' : 'border-amber-600/40 text-amber-300'}`}>
                  {current.useEvents ? 'CV-grounded' : 'pixels only'}
                </span>
                <button type="button" onClick={() => runNarrate(current)}
                  className="ml-auto text-xs text-slate-500 hover:text-slate-300">
                  Re-narrate
                </button>
              </div>
            )}

            {cur.status === 'error' && (
              <div className="rounded-lg border border-red-600/40 bg-red-600/10 px-3 py-2 text-sm text-red-300">
                {cur.error}
                <button type="button" onClick={() => runNarrate(current)} className="ml-2 underline">retry</button>
              </div>
            )}
          </div>

          {/* play-by-play (revealed after narration) + the reel list */}
          <div className="flex-1 overflow-y-auto p-4">
            {cur.status === 'done' && cur.result && (
              <div className="mb-4">
                {cur.result.narration.summary && (
                  <p className="mb-2 rounded-lg border border-accent-600/30 bg-accent-600/5 px-3 py-2 text-sm text-slate-100">
                    {cur.result.narration.summary}
                  </p>
                )}
                <ol className="space-y-2">
                  {cur.result.narration.play_by_play.map((ln, j) => (
                    <li key={j} className="animate-fade-in rounded border border-ink-700 bg-ink-850 px-2.5 py-2">
                      <p className="text-[13px] leading-relaxed text-slate-100">{ln.description}</p>
                      {detailTags(ln) && (
                        <p className="mt-1 text-[11px] font-medium capitalize text-brand-300">{detailTags(ln)}</p>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Reel</p>
            <div className="space-y-1.5">
              {items.map((it, i) => {
                const st = byPlay[it.playId]?.status
                return (
                  <div
                    key={it.playId}
                    ref={(el) => (rowRefs.current[i] = el)}
                    className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs ${
                      i === idx ? 'border-brand-500 bg-brand-500/10 text-slate-200' : 'border-ink-800 bg-ink-850 text-slate-500'
                    }`}
                  >
                    <span>{i + 1}</span>
                    <ClassificationBadge label={it.classification} />
                    <span className="ml-auto text-[10px]">
                      {st === 'done' ? '✓' : st === 'narrating' ? '…' : ''}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
