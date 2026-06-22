import { useEffect, useRef, useState } from 'react'
import type { NarrateResponse, PlayByPlayItem } from '../types'
import { ClassificationBadge } from './Badge'

/** One narrated play queued for the recording reel. */
export interface ReelItem {
  playId: string
  classification: string
  note: string
  angle: string
  clipUrl: string
  result: NarrateResponse
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

interface PresentationModeProps {
  items: ReelItem[]
  onExit: () => void
}

/**
 * Full-screen, record-ready playback: left ~72% plays the current clip; right ~28%
 * lists the plays with the active one highlighted + auto-scrolled. Clips auto-advance
 * on end and stop on the last one. Screen-record this to produce the investor video.
 */
export function PresentationMode({ items, onExit }: PresentationModeProps) {
  const [idx, setIdx] = useState(0)
  const rowRefs = useRef<Array<HTMLDivElement | null>>([])
  const current = items[idx]

  useEffect(() => {
    rowRefs.current[idx]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [idx])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onExit()
      if (e.key === 'ArrowRight') setIdx((i) => Math.min(i + 1, items.length - 1))
      if (e.key === 'ArrowLeft') setIdx((i) => Math.max(i - 1, 0))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onExit, items.length])

  if (!current) return null
  const advance = () => setIdx((i) => Math.min(i + 1, items.length - 1))
  const atEnd = idx >= items.length - 1

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ink-950">
      {/* top bar (kept minimal for a clean recording) */}
      <div className="flex items-center justify-between border-b border-ink-800 px-5 py-2.5">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-brand-500 to-accent-600 text-sm font-bold text-white">
            u
          </div>
          <span className="text-sm font-semibold text-slate-100">uball · VLM Play-by-Play</span>
          <span className="text-xs text-slate-500">Play {idx + 1} of {items.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIdx(0)}
            className="rounded-md border border-ink-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-ink-800"
          >
            Restart
          </button>
          <button
            type="button"
            onClick={onExit}
            className="rounded-md border border-ink-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-ink-800"
          >
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
              playsInline
              onEnded={advance}
              className="max-h-full max-w-full rounded-lg"
            />
          </div>
          <div className="border-t border-ink-800 bg-ink-950 px-5 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <ClassificationBadge label={current.classification} />
              {current.angle && <span className="text-xs text-slate-500">{current.angle}</span>}
              {current.result.used_events && (
                <span className="rounded border border-emerald-600/40 bg-emerald-600/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                  CV-grounded
                </span>
              )}
            </div>
            {current.result.narration.summary && (
              <p className="mt-1.5 text-base font-medium leading-snug text-slate-100">
                {current.result.narration.summary}
              </p>
            )}
          </div>
        </div>

        {/* right: play list */}
        <div className="overflow-y-auto border-l border-ink-800 bg-ink-900 p-4">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Play-by-play
          </p>
          <div className="space-y-3">
            {items.map((it, i) => {
              const active = i === idx
              return (
                <div
                  key={it.playId}
                  ref={(el) => (rowRefs.current[i] = el)}
                  className={`rounded-lg border p-3 transition-all duration-300 ${
                    active
                      ? 'border-brand-500 bg-brand-500/10'
                      : 'border-ink-800 bg-ink-850 opacity-45'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-500">{i + 1}</span>
                    <ClassificationBadge label={it.classification} />
                  </div>
                  {it.result.narration.summary && (
                    <p
                      className={`mt-1.5 text-sm leading-snug ${
                        active ? 'text-slate-100' : 'text-slate-400'
                      }`}
                    >
                      {it.result.narration.summary}
                    </p>
                  )}
                  {active && (
                    <ol className="mt-2 space-y-2">
                      {it.result.narration.play_by_play.map((ln, j) => (
                        <li
                          key={j}
                          className="animate-fade-in rounded border border-ink-700 bg-ink-900 px-2.5 py-2"
                        >
                          <p className="text-[13px] leading-relaxed text-slate-100">{ln.description}</p>
                          {detailTags(ln) && (
                            <p className="mt-1 text-[11px] font-medium capitalize text-brand-300">
                              {detailTags(ln)}
                            </p>
                          )}
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              )
            })}
          </div>
          {atEnd && (
            <p className="mt-4 text-center text-xs text-slate-600">— end of reel —</p>
          )}
        </div>
      </div>
    </div>
  )
}
