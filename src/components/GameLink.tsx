export default function GameLink(props: {
  label: string
  gameKey: string
  onOpenGame: (gameKey: string) => void
  inline?: boolean
  class?: string
}) {
  const className = () =>
    [props.inline ? 'gameButtonInline' : 'gameButton', props.class].filter(Boolean).join(' ')

  return (
    <button
      class={className()}
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        props.onOpenGame(props.gameKey)
      }}
    >
      {props.label}
    </button>
  )
}
