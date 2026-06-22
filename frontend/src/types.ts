// ---------------------------------------------------------------------------
// Shared API + domain types. These mirror the backend contract exactly.
// ---------------------------------------------------------------------------

export type ModelChoice = 'flash' | 'pro'
export type MediaResolution = 'low' | 'medium' | 'high'

export interface HealthDefaults {
  flash_model: string
  pro_model: string
  fps: number
  media_resolution: string
}

export interface HealthResponse {
  ok: boolean
  defaults: HealthDefaults
}

export interface GeminiModel {
  name: string
  display_name: string
}

export interface ModelsResponse {
  models: GeminiModel[]
}

export interface TeamInfo {
  name: string
  color: string
}

export interface Game {
  game_id: string
  date: string
  label: string
  team1: TeamInfo
  team2: TeamInfo
}

export interface GamesResponse {
  games: Game[]
}

export interface Play {
  play_id: string
  classification: string
  note: string
  angle: string
  start: number
  end: number
  player_a: string
  player_b: string
}

export interface PlaysResponse {
  plays: Play[]
}

// `events` and `context` are intentionally loose — the backend forwards
// whatever structured CV output exists for the play.
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

export interface PlayDetail {
  play_id: string
  game_id: string
  angle: string
  start: number
  end: number
  classification: string
  note: string
  events: JsonValue
  context: JsonValue
}

export interface PlayByPlayItem {
  description: string
  players: string[]
  action: string
  outcome: string
  timestamp: string | number
  confidence: number | string
}

export interface Narration {
  summary: string
  play_by_play: PlayByPlayItem[]
  caveats: string
}

export interface Usage {
  prompt_tokens: number
  output_tokens: number
  total_tokens: number
}

// Provenance of the exact clip the model saw (Supabase-backed plays only).
export interface ClipSource {
  s3_key: string
  angle: string
  kind: string
  start: number
  end: number
  seconds?: number
  size_mb?: number | null
  via: string
}

export interface NarrateResponse {
  model: string
  fps: number
  media_resolution: string
  used_events: boolean
  narration: Narration
  rendered: string
  usage: Usage
  clip_url?: string
  clip_source?: ClipSource
}

export interface NarratePlayRequest {
  play_id: string
  model: ModelChoice
  fps: number
  media_resolution: MediaResolution
  use_events: boolean
  api_key: string
}

// Settings persisted to localStorage.
export interface Settings {
  apiKey: string
  defaultModel: ModelChoice
  fps: number
  mediaResolution: MediaResolution
}
