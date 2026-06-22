interface ErrorBannerProps {
  message: string | null
  onDismiss?: () => void
  className?: string
}

/** Inline, non-blocking error banner for API/FastAPI `detail` messages. */
export function ErrorBanner({ message, onDismiss, className }: ErrorBannerProps) {
  if (!message) return null
  return (
    <div
      role="alert"
      className={`flex items-start justify-between gap-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300 ${className ?? ''}`}
    >
      <span className="break-words">{message}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 text-red-400/70 hover:text-red-300"
          aria-label="Dismiss error"
        >
          ✕
        </button>
      )}
    </div>
  )
}
