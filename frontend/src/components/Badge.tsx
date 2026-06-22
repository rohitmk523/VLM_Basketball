interface BadgeProps {
  label: string
  tone?: 'neutral' | 'brand' | 'accent' | 'green' | 'amber'
}

const TONES: Record<NonNullable<BadgeProps['tone']>, string> = {
  neutral: 'border-ink-600 bg-ink-800 text-slate-300',
  brand: 'border-brand-600/40 bg-brand-600/15 text-brand-400',
  accent: 'border-accent-600/40 bg-accent-600/15 text-accent-400',
  green: 'border-emerald-600/40 bg-emerald-600/15 text-emerald-400',
  amber: 'border-amber-600/40 bg-amber-600/15 text-amber-400',
}

/** Pick a stable tone from a classification string so badges are color-coded. */
function toneForClassification(label: string): BadgeProps['tone'] {
  const l = label.toLowerCase()
  if (/(make|score|made|bucket|and-?one|assist)/.test(l)) return 'green'
  if (/(miss|turnover|foul|block|steal)/.test(l)) return 'amber'
  if (/(shot|jumper|layup|dunk|three|3pt|fadeaway)/.test(l)) return 'accent'
  return 'brand'
}

export function Badge({ label, tone }: BadgeProps) {
  const resolved = tone ?? 'neutral'
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${TONES[resolved]}`}
    >
      {label}
    </span>
  )
}

export function ClassificationBadge({ label }: { label: string }) {
  if (!label) return null
  return <Badge label={label} tone={toneForClassification(label)} />
}
