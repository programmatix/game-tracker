import { createMemo } from 'solid-js'

export default function ProgressBar(props: {
  value: number
  target: number
  widthPx?: number
  label?: string
}) {
  const clampedTarget = createMemo(() => (props.target > 0 ? props.target : 1))
  const clampedValue = createMemo(() => Math.max(0, props.value))
  const ratio = createMemo(() => clampedValue() / clampedTarget())
  const percent = createMemo(() => Math.min(100, Math.max(0, ratio() * 100)))
  const isComplete = createMemo(() => clampedValue() >= clampedTarget())
  const title = createMemo(
    () => props.label ?? `${clampedValue().toLocaleString()}/${props.target.toLocaleString()}`,
  )

  return (
    <span
      class="progressInline"
      title={title()}
      aria-label={title()}
      style={{
        '--progress-width': `${props.widthPx ?? 140}px`,
      }}
    >
      <span
        classList={{
          progressBar: true,
          progressBarComplete: isComplete(),
        }}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={clampedTarget()}
        aria-valuenow={clampedValue()}
      >
        <span
          class="progressFill"
          style={{
            width: `${percent()}%`,
          }}
        />
      </span>
      <span class="progressLabel mono">{title()}</span>
    </span>
  )
}
