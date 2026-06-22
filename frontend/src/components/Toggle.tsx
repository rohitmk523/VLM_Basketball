interface ToggleProps {
  checked: boolean
  onChange: (next: boolean) => void
  label?: string
  description?: string
  disabled?: boolean
}

/** Accessible on/off switch. */
export function Toggle({ checked, onChange, label, description, disabled }: ToggleProps) {
  return (
    <label
      className={`flex items-center gap-3 ${disabled ? 'opacity-50' : 'cursor-pointer'}`}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
          checked ? 'bg-brand-500' : 'bg-ink-600'
        } ${disabled ? 'cursor-not-allowed' : ''}`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
      {(label || description) && (
        <span className="select-none">
          {label && <span className="block text-sm font-medium text-slate-200">{label}</span>}
          {description && <span className="block text-xs text-slate-500">{description}</span>}
        </span>
      )}
    </label>
  )
}
