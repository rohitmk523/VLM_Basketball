import { useEffect, useState } from 'react'
import { Spinner } from './Spinner'

const STEPS = [
  'Uploading clip…',
  'Sampling frames…',
  'Grounding on CV events…',
  'Generating play-by-play…',
]

/** Animated placeholder while a narration request is in flight (10-40s). */
export function NarrationLoading() {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const start = Date.now()
    const id = window.setInterval(() => {
      setElapsed((Date.now() - start) / 1000)
    }, 100)
    return () => window.clearInterval(id)
  }, [])

  const step = Math.min(STEPS.length - 1, Math.floor(elapsed / 8))

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 text-sm text-slate-300">
        <Spinner className="h-5 w-5 text-brand-400" />
        <span>{STEPS[step]}</span>
        <span className="ml-auto font-mono text-xs text-slate-500">{elapsed.toFixed(1)}s</span>
      </div>

      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="relative h-12 overflow-hidden rounded-lg border border-ink-700 bg-ink-850"
          >
            <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-ink-700/40 to-transparent" />
          </div>
        ))}
      </div>

      <p className="text-[11px] text-slate-500">
        Narration usually takes 10–40 seconds depending on clip length and model.
      </p>
    </div>
  )
}
