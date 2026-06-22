import { useEffect, useState } from 'react'
import type { HealthResponse } from './types'
import { API_BASE, getHealth } from './lib/api'
import { useSettings } from './lib/useSettings'
import { TopBar, type HealthStatus } from './components/TopBar'
import { SettingsDrawer } from './components/SettingsDrawer'
import { SupabaseMode } from './components/SupabaseMode'
import { ManualMode } from './components/ManualMode'
import { DatabaseIcon, UploadIcon } from './components/icons'

type Tab = 'supabase' | 'manual'

export default function App() {
  const { settings, update } = useSettings()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('supabase')

  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [status, setStatus] = useState<HealthStatus>('checking')

  // Health check on mount; refresh periodically so the dot stays accurate.
  useEffect(() => {
    let cancelled = false
    const check = async () => {
      try {
        const res = await getHealth()
        if (cancelled) return
        setHealth(res)
        setStatus(res.ok ? 'online' : 'offline')
      } catch {
        if (cancelled) return
        setStatus('offline')
      }
    }
    check()
    const id = window.setInterval(check, 20000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [])

  return (
    <div className="min-h-full bg-ink-950">
      <TopBar
        status={status}
        health={health}
        apiBase={API_BASE}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <SettingsDrawer
        open={settingsOpen}
        settings={settings}
        apiBase={API_BASE}
        onClose={() => setSettingsOpen(false)}
        onChange={update}
      />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {/* Tabs */}
        <div className="mb-6 inline-flex rounded-xl border border-ink-700 bg-ink-850 p-1">
          <button
            type="button"
            onClick={() => setTab('supabase')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === 'supabase'
                ? 'bg-brand-500 text-white shadow'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <DatabaseIcon className="h-4 w-4" />
            From Supabase
          </button>
          <button
            type="button"
            onClick={() => setTab('manual')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === 'manual'
                ? 'bg-brand-500 text-white shadow'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <UploadIcon className="h-4 w-4" />
            Manual upload
          </button>
        </div>

        {status === 'offline' && (
          <div className="mb-6 rounded-lg border border-amber-600/40 bg-amber-600/10 px-4 py-3 text-sm text-amber-300">
            Can&apos;t reach the backend at{' '}
            <span className="font-mono">{API_BASE}</span>. Start the FastAPI server, or set{' '}
            <span className="font-mono">VITE_API_BASE</span> in a{' '}
            <span className="font-mono">.env</span> file.
          </div>
        )}

        {tab === 'supabase' ? (
          <SupabaseMode settings={settings} onOpenSettings={() => setSettingsOpen(true)} />
        ) : (
          <ManualMode settings={settings} onOpenSettings={() => setSettingsOpen(true)} />
        )}
      </main>

      <footer className="mx-auto max-w-7xl px-4 pb-8 pt-2 text-center text-[11px] text-slate-600 sm:px-6">
        uball · VLM Play-by-Play research demo · keys stored locally in your browser
      </footer>
    </div>
  )
}
