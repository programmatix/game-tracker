export default function GameOptionsButton(props: {
  gameId: string
  gameLabel: string
  onOpenGameOptions: (gameId: string) => void
}) {
  const label = `Open options for ${props.gameLabel}`

  return (
    <button
      type="button"
      class="linkButton gameOptionsCogButton"
      title={label}
      aria-label={label}
      onClick={() => props.onOpenGameOptions(props.gameId)}
    >
      ⚙
    </button>
  )
}
