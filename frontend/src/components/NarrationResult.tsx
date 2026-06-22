import { useState } from 'react'
import type { NarrateResponse, PlayByPlayItem } from '../types'
import { JsonViewer } from './JsonViewer'

interface NarrationResultProps {
  result: NarrateResponse
  elapsedSeconds: number | null
}

function confidenceTone(confidence: number | string): string {
  const n = typeof confidence === 'number' ? confidence : Number(confidence)
  if (!Number.isFinite(n)) return 'text-slate-500'
  if (n >= 0.75) return 'text-emerald-400'
  if (n >= 0.5) return 'text-amber-400'
  return 'text-red-400'
}

function formatConfidence(confidence: number | string): string {
  const n = typeof confidence === 'number' ? confidence : Number(confidence)
  if (!Number.isFinite(n)) return String(confidence)
  return `${Math.round(n * 100)}%`
}

function PlayByPlayRow({ item, index }: { item: PlayByPlayItem; index: number }) {
  return (
    <li className="animate-fade-in rounded-lg border border-ink-700 bg-ink-850 px-3 py-2.5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-ink-700 text-xs font-semibold text-slate-300">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-relaxed text-slate-100">{item.description}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
            {item.action && (
              <span>
                <span className="text-slate-600">action</span>{' '}
                <span className="text-slate-300">{item.action}</span>
              </span>
            )}
            {item.outcome && (
              <span>
                <span className="text-slate-600">outcome</span>{' '}
                <span className="text-slate-300">{item.outcome}</span>
              </span>
            )}
            {item.players?.length > 0 && (
              <span>
                <span className="text-slate-600">players</span>{' '}
                <span className="text-slate-300">{item.players.join(', ')}</span>
              </span>
            )}
            {item.timestamp !== undefined && item.timestamp !== '' && (
              <span className="font-mono text-slate-400">@ {String(item.timestamp)}</span>
            )}
            {item.confidence !== undefined && item.confidence !== '' && (
              <span className={confidenceTone(item.confidence)}>
                {formatConfidence(item.confidence)}
              </span>
            )}
          </div>
        </div>
      </div>
    </li>
  )
}

export function NarrationResult({ result, elapsedSeconds }: NarrationResultProps) {
  const [showRaw, setShowRaw] = useState(false)
  const { narration, usage } = result

  return (
    <div className="space-y-4">
      {/* Chips row */}
      <div className="flex flex-wrap gap-2">
        <span className="chip">
          <span className="text-slate-500">model</span> {result.model}
        </span>
        <span className="chip">
          <span className="text-slate-500">fps</span> {result.fps}
        </span>
        <span className="chip">
          <span className="text-slate-500">media</span> {result.media_resolution}
        </span>
        <span
          className={`chip ${
            result.used_events
              ? 'border-emerald-600/40 bg-emerald-600/10 text-emerald-300'
              : 'border-amber-600/40 bg-amber-600/10 text-amber-300'
          }`}
        >
          events {result.used_events ? 'ON' : 'OFF'}
        </span>
        {usage && (
          <span className="chip">
            <span className="text-slate-500">tokens</span> {usage.total_tokens}
          </span>
        )}
        {elapsedSeconds != null && (
          <span className="chip">
            <span className="text-slate-500">elapsed</span> {elapsedSeconds.toFixed(1)}s
          </span>
        )}
      </div>

      {/* Summary */}
      {narration.summary && (
        <div className="rounded-lg border border-accent-600/30 bg-accent-600/5 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-accent-400">
            Summary
          </p>
          <p className="mt-1 text-sm leading-relaxed text-slate-100">{narration.summary}</p>
        </div>
      )}

      {/* Play-by-play */}
      {narration.play_by_play?.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Play-by-play
          </p>
          <ol className="space-y-2">
            {narration.play_by_play.map((item, i) => (
              <PlayByPlayRow key={i} item={item} index={i} />
            ))}
          </ol>
        </div>
      )}

      {/* Caveats */}
      {narration.caveats && (
        <div className="rounded-lg border border-amber-600/30 bg-amber-600/5 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-400">
            Caveats
          </p>
          <p className="mt-1 text-sm leading-relaxed text-slate-300">{narration.caveats}</p>
        </div>
      )}

      {/* Rendered (monospace, preserves newlines) */}
      {result.rendered && (
        <div className="overflow-hidden rounded-lg border border-ink-700 bg-ink-900">
          <div className="border-b border-ink-700 bg-ink-850 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Rendered output
          </div>
          <pre className="overflow-auto whitespace-pre-wrap px-4 py-3 font-mono text-[12px] leading-relaxed text-slate-200">
            {result.rendered}
          </pre>
        </div>
      )}

      {/* Raw structured JSON */}
      <div>
        <button
          type="button"
          onClick={() => setShowRaw((s) => !s)}
          className="text-xs text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline"
        >
          {showRaw ? 'Hide' : 'Show'} raw structured JSON
        </button>
        {showRaw && (
          <div className="mt-2">
            <JsonViewer value={narration} title="narration" defaultOpen maxHeight={300} />
          </div>
        )}
      </div>
    </div>
  )
}
