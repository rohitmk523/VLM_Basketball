import type { MediaResolution, ModelChoice } from '../types'

interface NarrationControlsProps {
  model: ModelChoice
  fps: number
  mediaResolution: MediaResolution
  onModel: (m: ModelChoice) => void
  onFps: (n: number) => void
  onMediaResolution: (r: MediaResolution) => void
  disabled?: boolean
}

/** Compact model / fps / media-resolution controls shared by both modes. */
export function NarrationControls({
  model,
  fps,
  mediaResolution,
  onModel,
  onFps,
  onMediaResolution,
  disabled,
}: NarrationControlsProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-400">Model</label>
        <select
          value={model}
          disabled={disabled}
          onChange={(e) => onModel(e.target.value as ModelChoice)}
          className="input"
        >
          <option value="flash">flash · Gemini 3.5 Flash</option>
          <option value="pro">pro · Gemini 3.1 Pro</option>
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-400">FPS</label>
        <input
          type="number"
          min={1}
          max={30}
          step={1}
          value={fps}
          disabled={disabled}
          onChange={(e) => {
            const n = Number(e.target.value)
            onFps(Number.isFinite(n) && n > 0 ? n : 1)
          }}
          className="input"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-400">Media resolution</label>
        <select
          value={mediaResolution}
          disabled={disabled}
          onChange={(e) => onMediaResolution(e.target.value as MediaResolution)}
          className="input"
        >
          <option value="low">low</option>
          <option value="medium">medium</option>
          <option value="high">high</option>
        </select>
      </div>
    </div>
  )
}
