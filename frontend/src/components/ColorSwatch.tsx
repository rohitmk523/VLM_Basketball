import { resolveColor, isLightColor } from '../lib/colors'

interface ColorSwatchProps {
  color: string
  size?: number
  title?: string
}

/** A small jersey-color dot derived from a team color string. */
export function ColorSwatch({ color, size = 12, title }: ColorSwatchProps) {
  const hex = resolveColor(color)
  const light = isLightColor(hex)
  return (
    <span
      title={title ?? color}
      className="inline-block flex-shrink-0 rounded-full"
      style={{
        width: size,
        height: size,
        backgroundColor: hex,
        border: light ? '1px solid rgba(148,163,184,0.6)' : '1px solid rgba(0,0,0,0.4)',
      }}
    />
  )
}
