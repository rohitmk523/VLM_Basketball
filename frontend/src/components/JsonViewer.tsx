import { useMemo, useState } from 'react'
import { ChevronIcon } from './icons'

interface JsonViewerProps {
  value: unknown
  title?: string
  defaultOpen?: boolean
  maxHeight?: number
}

function summarize(value: unknown): string {
  if (Array.isArray(value)) return `array · ${value.length} item${value.length === 1 ? '' : 's'}`
  if (value && typeof value === 'object') {
    const n = Object.keys(value as object).length
    return `object · ${n} key${n === 1 ? '' : 's'}`
  }
  if (value == null) return 'null'
  return typeof value
}

/** Collapsible, pretty-printed JSON viewer with a copy button. */
export function JsonViewer({
  value,
  title = 'JSON',
  defaultOpen = true,
  maxHeight = 360,
}: JsonViewerProps) {
  const [open, setOpen] = useState(defaultOpen)
  const [copied, setCopied] = useState(false)

  const pretty = useMemo(() => {
    try {
      return JSON.stringify(value, null, 2)
    } catch {
      return String(value)
    }
  }, [value])

  const isEmpty =
    value == null ||
    (Array.isArray(value) && value.length === 0) ||
    (typeof value === 'object' && !Array.isArray(value) && Object.keys(value as object).length === 0)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(pretty)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
    } catch {
      // clipboard may be blocked — ignore
    }
  }

  return (
    <div className="overflow-hidden rounded-lg border border-ink-700 bg-ink-900">
      <div className="flex items-center justify-between gap-2 border-b border-ink-700 bg-ink-850 px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 text-sm font-medium text-slate-200"
        >
          <ChevronIcon
            className={`h-4 w-4 text-slate-400 transition-transform ${open ? '' : '-rotate-90'}`}
          />
          <span>{title}</span>
          <span className="text-xs font-normal text-slate-500">{summarize(value)}</span>
        </button>
        {!isEmpty && (
          <button
            type="button"
            onClick={copy}
            className="rounded border border-ink-600 px-2 py-0.5 text-xs text-slate-400 hover:bg-ink-700 hover:text-slate-200"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        )}
      </div>
      {open &&
        (isEmpty ? (
          <div className="px-3 py-4 text-sm italic text-slate-500">No data provided.</div>
        ) : (
          <pre
            className="overflow-auto px-3 py-3 font-mono text-[12px] leading-relaxed text-slate-300"
            style={{ maxHeight }}
          >
            {pretty}
          </pre>
        ))}
    </div>
  )
}
