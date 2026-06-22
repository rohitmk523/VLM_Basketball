import type {
  GamesResponse,
  HealthResponse,
  ModelsResponse,
  NarratePlayRequest,
  NarrateResponse,
  PlayDetail,
  PlaysResponse,
} from '../types'

export const API_BASE: string =
  (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/+$/, '') ??
  'http://127.0.0.1:8000'

/** Error carrying the FastAPI `detail` string (or a fallback) and HTTP status. */
export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

function url(path: string): string {
  return `${API_BASE}${path}`
}

/** Build the streaming clip URL for a play (used directly as a <video src>). */
export function clipUrl(playId: string): string {
  return url(`/api/plays/${encodeURIComponent(playId)}/clip`)
}

/** Extract a human-readable error message from a non-2xx response. */
async function readError(res: Response): Promise<never> {
  let message = `Request failed (${res.status})`
  try {
    const data = (await res.json()) as unknown
    if (data && typeof data === 'object' && 'detail' in data) {
      const detail = (data as { detail: unknown }).detail
      if (typeof detail === 'string') {
        message = detail
      } else if (detail != null) {
        message = JSON.stringify(detail)
      }
    }
  } catch {
    try {
      const text = await res.text()
      if (text) message = text
    } catch {
      // ignore — keep the status-based message
    }
  }
  throw new ApiError(message, res.status)
}

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  let res: Response
  try {
    res = await fetch(url(path), { signal, headers: { Accept: 'application/json' } })
  } catch (err) {
    throw new ApiError(
      err instanceof Error ? `Network error: ${err.message}` : 'Network error',
      0,
    )
  }
  if (!res.ok) return readError(res)
  return (await res.json()) as T
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

export function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  return getJson<HealthResponse>('/api/health', signal)
}

export function getModels(apiKey: string, signal?: AbortSignal): Promise<ModelsResponse> {
  const qs = new URLSearchParams({ api_key: apiKey }).toString()
  return getJson<ModelsResponse>(`/api/models?${qs}`, signal)
}

export function getGames(signal?: AbortSignal): Promise<GamesResponse> {
  return getJson<GamesResponse>('/api/games', signal)
}

export function getPlays(gameId: string, signal?: AbortSignal): Promise<PlaysResponse> {
  return getJson<PlaysResponse>(`/api/games/${encodeURIComponent(gameId)}/plays`, signal)
}

export function getPlay(playId: string, signal?: AbortSignal): Promise<PlayDetail> {
  return getJson<PlayDetail>(`/api/plays/${encodeURIComponent(playId)}`, signal)
}

/** Narrate a Supabase-backed play. Sends api_key in body AND as header. */
export async function narratePlay(
  req: NarratePlayRequest,
  signal?: AbortSignal,
): Promise<NarrateResponse> {
  let res: Response
  try {
    res = await fetch(url('/api/narrate_play'), {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Goog-Api-Key': req.api_key,
      },
      body: JSON.stringify(req),
    })
  } catch (err) {
    throw new ApiError(
      err instanceof Error ? `Network error: ${err.message}` : 'Network error',
      0,
    )
  }
  if (!res.ok) return readError(res)
  return (await res.json()) as NarrateResponse
}

export interface NarrateManualParams {
  file: File
  model: string
  fps: number
  mediaResolution: string
  events?: string
  context?: string
  apiKey: string
}

/** Narrate a manually-uploaded clip via multipart form. */
export async function narrateManual(
  params: NarrateManualParams,
  signal?: AbortSignal,
): Promise<NarrateResponse> {
  const form = new FormData()
  form.append('file', params.file)
  form.append('model', params.model)
  form.append('fps', String(params.fps))
  form.append('media_resolution', params.mediaResolution)
  if (params.events && params.events.trim()) form.append('events', params.events)
  if (params.context && params.context.trim()) form.append('context', params.context)
  form.append('api_key', params.apiKey)

  let res: Response
  try {
    res = await fetch(url('/api/narrate'), {
      method: 'POST',
      signal,
      headers: {
        Accept: 'application/json',
        'X-Goog-Api-Key': params.apiKey,
      },
      body: form,
    })
  } catch (err) {
    throw new ApiError(
      err instanceof Error ? `Network error: ${err.message}` : 'Network error',
      0,
    )
  }
  if (!res.ok) return readError(res)
  return (await res.json()) as NarrateResponse
}
