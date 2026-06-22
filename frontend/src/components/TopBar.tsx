import { GearIcon } from './icons'
import type { HealthResponse } from '../types'

export type HealthStatus = 'checking' | 'online' | 'offline'

interface TopBarProps {
  status: HealthStatus
  health: HealthResponse | null
  apiBase: string
  onOpenSettings: () => void
}

const STATUS_META: Record<HealthStatus, { dot: string; ring: string; text: string }> = {
  checking: { dot: 'bg-amber-400', ring: 'bg-amber-400/30', text: 'Connecting…' },
  online: { dot: 'bg-emerald-400', ring: 'bg-emerald-400/30', text: 'Backend online' },
  offline: { dot: 'bg-red-400', ring: 'bg-red-400/30', text: 'Backend offline' },
}

export function TopBar({ status, health, apiBase, onOpenSettings }: TopBarProps) {
  const meta = STATUS_META[status]
  return (
    <header className="sticky top-0 z-30 border-b border-ink-700 bg-ink-950/85 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 text-base font-bold text-white shadow-md shadow-brand-600/30">
            u
          </div>
          <div className="leading-tight">
            <h1 className="text-sm font-semibold text-slate-100 sm:text-base">
              uball · VLM Play-by-Play
            </h1>
            <p className="text-[11px] text-slate-500">research demo</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div
            className="hidden items-center gap-2 rounded-full border border-ink-700 bg-ink-850 px-3 py-1.5 sm:flex"
            title={`${meta.text} · ${apiBase}`}
          >
            <span className="relative flex h-2.5 w-2.5">
              {status !== 'offline' && (
                <span
                  className={`absolute inline-flex h-full w-full animate-ping rounded-full ${meta.ring}`}
                />
              )}
              <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${meta.dot}`} />
            </span>
            <span className="text-xs font-medium text-slate-300">{meta.text}</span>
            {status === 'online' && health && (
              <span className="text-[11px] text-slate-500">
                · fps {health.defaults.fps} · {health.defaults.media_resolution}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={onOpenSettings}
            className="btn btn-ghost px-3 py-2"
            aria-label="Open settings"
          >
            <GearIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Settings</span>
          </button>
        </div>
      </div>
    </header>
  )
}
