// ---------------------------------------------------------------------------
// Cost model for the narration pipeline. Rates are PLACEHOLDER ASSUMPTIONS in
// USD per 1M tokens — update PRICING to your contracted Gemini rates. They are
// shown in the UI so the estimate is always honest about its inputs.
// ---------------------------------------------------------------------------
import type { Usage } from '../types'

export interface TokenRate {
  /** USD per 1M input (prompt) tokens. */
  input: number
  /** USD per 1M output (candidate) tokens. */
  output: number
  /** Human label shown in the panel. */
  label: string
}

// Keyed by a substring matched against the resolved model id.
export const PRICING: Record<'flash' | 'pro', TokenRate> = {
  flash: { input: 0.075, output: 0.3, label: 'flash' },
  pro: { input: 1.25, output: 5.0, label: 'pro' },
}

export function rateFor(model: string): TokenRate {
  const m = model.toLowerCase()
  if (m.includes('pro')) return PRICING.pro
  return PRICING.flash
}

export interface CostEstimate {
  input: number
  output: number
  total: number
  rate: TokenRate
}

/** Per-play cost from token usage. Returns zeros if usage is unavailable. */
export function estimateCost(model: string, usage?: Usage): CostEstimate {
  const rate = rateFor(model)
  const inTok = Number(usage?.prompt_tokens ?? 0) || 0
  const outTok = Number(usage?.output_tokens ?? 0) || 0
  const input = (inTok / 1_000_000) * rate.input
  const output = (outTok / 1_000_000) * rate.output
  return { input, output, total: input + output, rate }
}

/** Format a USD amount with enough precision to show sub-cent per-play costs. */
export function formatUsd(amount: number): string {
  if (amount === 0) return '$0'
  if (amount < 0.01) return `$${amount.toFixed(4)}`
  if (amount < 1) return `$${amount.toFixed(3)}`
  return `$${amount.toFixed(2)}`
}
