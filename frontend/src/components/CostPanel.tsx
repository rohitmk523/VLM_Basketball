import type { NarrateResponse } from '../types'
import { estimateCost, formatUsd } from '../lib/pricing'

interface CostPanelProps {
  result: NarrateResponse
  elapsedSeconds: number | null
  /** Plays in the selected game, for a rough per-game projection. */
  playsInGame?: number
}

interface MetricProps {
  label: string
  value: string
  sub?: string
  accent?: boolean
}

function Metric({ label, value, sub, accent }: MetricProps) {
  return (
    <div
      className={`rounded-lg border px-3 py-2.5 ${
        accent ? 'border-accent-600/30 bg-accent-600/5' : 'border-ink-700 bg-ink-850'
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-0.5 font-mono text-sm ${accent ? 'text-accent-300' : 'text-slate-100'}`}>
        {value}
      </p>
      {sub && <p className="mt-0.5 text-[10px] text-slate-500">{sub}</p>}
    </div>
  )
}

export function CostPanel({ result, elapsedSeconds, playsInGame }: CostPanelProps) {
  const cost = estimateCost(result.model, result.usage)
  const clip = result.clip_source
  const clipSeconds = clip?.seconds
  const vlmSeconds =
    clipSeconds != null ? Math.round(clipSeconds * result.fps) : undefined
  const total = result.usage?.total_tokens

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          Cost &amp; latency
        </p>
        <span className="text-[10px] text-slate-600">est. · rates editable</span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Metric
          label="Cost / play"
          value={formatUsd(cost.total)}
          sub={`in ${formatUsd(cost.input)} · out ${formatUsd(cost.output)}`}
          accent
        />
        <Metric
          label="Tokens"
          value={total != null ? total.toLocaleString() : '—'}
          sub={`in ${result.usage?.prompt_tokens ?? '—'} · out ${
            result.usage?.output_tokens ?? '—'
          }`}
        />
        <Metric
          label="Latency"
          value={elapsedSeconds != null ? `${elapsedSeconds.toFixed(1)}s` : '—'}
          sub={`${cost.rate.label} · $${cost.rate.input}/$${cost.rate.output} per 1M`}
        />
        <Metric
          label="VLM-seconds"
          value={vlmSeconds != null ? `${vlmSeconds}` : '—'}
          sub={clipSeconds != null ? `${clipSeconds}s × ${result.fps}fps` : 'cost lever'}
        />
        <Metric
          label="Clip fetched"
          value={clip?.size_mb != null ? `${clip.size_mb} MB` : '—'}
          sub={clip?.via === 's3_presigned_range' ? 'S3 range — no full download' : clip?.via}
        />
        <Metric
          label="Projected / game"
          value={playsInGame ? formatUsd(cost.total * playsInGame) : '—'}
          sub={playsInGame ? `× ${playsInGame} plays` : 'select a game'}
        />
      </div>
    </div>
  )
}
