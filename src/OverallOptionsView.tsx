import { createSignal } from 'solid-js'
import { countThingSummaryCacheEntries } from './bgg'

export default function OverallOptionsView(props: { onClearBggThingCache: () => number }) {
  const [cachedEntries, setCachedEntries] = createSignal(countThingSummaryCacheEntries())
  const [statusMessage, setStatusMessage] = createSignal<string | null>(null)

  const clearThingCache = () => {
    const removed = props.onClearBggThingCache()
    setCachedEntries(countThingSummaryCacheEntries())
    setStatusMessage(
      removed === 1 ? 'Cleared 1 cached BGG thing entry.' : `Cleared ${removed} cached BGG thing entries.`,
    )
  }

  return (
    <div class="statsBlock gameOptionsView">
      <div class="statsTitleRow">
        <h3 class="statsTitle">Options</h3>
        <div class="muted">Global app settings and maintenance tools.</div>
      </div>

      <section class="gameOptionsCard">
        <div class="gameOptionsCardHeader">
          <h4>BGG cache</h4>
          <div class="muted mono">{cachedEntries().toLocaleString()} cached</div>
        </div>

        <div class="gameOptionsRows">
          <div class="gameOptionRow">
            <div class="gameOptionCopy">
              <div class="gameOptionTitle">Cached BGG thing details</div>
              <div class="muted">
                Stores BGG `thing` responses in your browser for 30 days. This covers play-time
                estimates for zero-length plays, plus any fetched thing thumbnails and names.
              </div>
              <div class="muted">
                Use clear cache if you want to force fresh `thing` lookups from BGG.
              </div>
              {statusMessage() ? <div class="muted">{statusMessage()}</div> : null}
            </div>
            <button class="linkButton" type="button" onClick={clearThingCache}>
              Clear cache
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
