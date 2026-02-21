import { Show } from 'solid-js'

export default function GameThingThumb(props: {
  objectId: string
  image?: string
  thumbnail?: string
  alt: string
  loading?: 'eager' | 'lazy'
}) {
  return (
    <Show when={props.image || props.thumbnail}>
      {(src) => (
        <a
          class="gameThingThumbLink"
          href={`https://boardgamegeek.com/boardgame/${props.objectId}`}
          target="_blank"
          rel="noreferrer"
          title="View on BoardGameGeek"
        >
          <img class="gameThingThumb" src={src()} alt={props.alt} loading={props.loading ?? 'lazy'} />
        </a>
      )}
    </Show>
  )
}
