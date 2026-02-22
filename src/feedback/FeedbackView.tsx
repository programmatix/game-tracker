import type { User } from 'firebase/auth'
import { For, Show, createEffect, createMemo, createSignal, onCleanup } from 'solid-js'
import {
  createFeedback,
  resolveFeedback,
  subscribeAllFeedback,
  subscribeFeedbackForUser,
  type FeedbackItem,
} from './feedbackFirebase'

type Props = {
  user: User | null
  isAdmin: boolean
}

function formatDateTime(valueMs: number | null): string {
  if (!valueMs) return '—'
  return new Date(valueMs).toLocaleString()
}

export default function FeedbackView(props: Props) {
  const [message, setMessage] = createSignal('')
  const [feedbackItems, setFeedbackItems] = createSignal<FeedbackItem[]>([])
  const [allFeedbackItems, setAllFeedbackItems] = createSignal<FeedbackItem[]>([])
  const [submitError, setSubmitError] = createSignal<string | null>(null)
  const [submitStatus, setSubmitStatus] = createSignal<string | null>(null)
  const [isSubmitting, setIsSubmitting] = createSignal(false)
  const [isResolvingId, setIsResolvingId] = createSignal<string | null>(null)
  const [resolveError, setResolveError] = createSignal<string | null>(null)

  const canSubmit = createMemo(() => Boolean(props.user && message().trim()))

  createEffect(() => {
    const user = props.user
    if (!user) {
      setFeedbackItems([])
      setAllFeedbackItems([])
      return
    }

    const unsubscribeMine = subscribeFeedbackForUser(user, (items) => {
      setFeedbackItems(items)
    })

    let unsubscribeAll = () => {}
    if (props.isAdmin) {
      unsubscribeAll = subscribeAllFeedback((items) => {
        setAllFeedbackItems(items)
      })
    } else {
      setAllFeedbackItems([])
    }

    onCleanup(() => {
      unsubscribeMine()
      unsubscribeAll()
    })
  })

  async function onSubmitFeedback(event: SubmitEvent) {
    event.preventDefault()
    const user = props.user
    if (!user) return

    setSubmitError(null)
    setSubmitStatus(null)
    setIsSubmitting(true)
    try {
      await createFeedback(user, message())
      setMessage('')
      setSubmitStatus('Feedback submitted.')
    } catch (error) {
      const errorText = error instanceof Error ? error.message : String(error)
      setSubmitError(errorText || 'Failed to submit feedback.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function onResolveFeedback(item: FeedbackItem) {
    const user = props.user
    if (!props.isAdmin || !user || item.status === 'resolved') return

    setResolveError(null)
    setIsResolvingId(item.id)
    try {
      await resolveFeedback(item.id, user)
    } catch (error) {
      const errorText = error instanceof Error ? error.message : String(error)
      setResolveError(errorText || 'Failed to resolve feedback.')
    } finally {
      setIsResolvingId(null)
    }
  }

  return (
    <div class="feedbackView">
      <div class="feedbackBlock">
        <h3 class="statsTitle">Submit feedback</h3>
        <Show when={props.user} fallback={<div class="muted">Sign in to submit feedback.</div>}>
          <form class="feedbackForm" onSubmit={onSubmitFeedback}>
            <label class="feedbackField">
              <span class="muted">Message</span>
              <textarea
                class="feedbackTextarea"
                rows="4"
                placeholder="Describe the issue or suggestion"
                value={message()}
                onInput={(event) => setMessage(event.currentTarget.value)}
              />
            </label>
            <div class="feedbackActions">
              <button type="submit" disabled={!canSubmit() || isSubmitting()}>
                {isSubmitting() ? 'Submitting…' : 'Submit feedback'}
              </button>
              <Show when={submitStatus()}>
                {(status) => <span class="muted">{status()}</span>}
              </Show>
            </div>
            <Show when={submitError()}>
              {(errorText) => <div class="error">{errorText()}</div>}
            </Show>
          </form>
        </Show>
      </div>

      <div class="feedbackBlock">
        <h3 class="statsTitle">My feedback</h3>
        <Show when={feedbackItems().length > 0} fallback={<div class="muted">No feedback yet.</div>}>
          <div class="tableWrap">
            <table class="table tableCompact feedbackTable">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Message</th>
                  <th>Created</th>
                  <th>Resolved</th>
                </tr>
              </thead>
              <tbody>
                <For each={feedbackItems()}>
                  {(item) => (
                    <tr>
                      <td>
                        <span
                          class="statusPill"
                          classList={{ statusResolved: item.status === 'resolved' }}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td>{item.message}</td>
                      <td class="mono">{formatDateTime(item.createdAtMs)}</td>
                      <td class="mono">{formatDateTime(item.resolvedAtMs)}</td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </Show>
      </div>

      <Show when={props.isAdmin}>
        <div class="feedbackBlock">
          <h3 class="statsTitle">All feedback</h3>
          <Show when={resolveError()}>
            {(errorText) => <div class="error">{errorText()}</div>}
          </Show>
          <Show when={allFeedbackItems().length > 0} fallback={<div class="muted">No feedback yet.</div>}>
            <div class="tableWrap">
              <table class="table feedbackTable">
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>User</th>
                    <th>Message</th>
                    <th>Created</th>
                    <th>Resolved</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={allFeedbackItems()}>
                    {(item) => (
                      <tr>
                        <td>
                          <span
                            class="statusPill"
                            classList={{ statusResolved: item.status === 'resolved' }}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td>
                          <div>{item.ownerDisplayName || 'Unknown'}</div>
                          <div class="muted mono">{item.ownerEmail || '—'}</div>
                        </td>
                        <td>{item.message}</td>
                        <td class="mono">{formatDateTime(item.createdAtMs)}</td>
                        <td class="mono">{formatDateTime(item.resolvedAtMs)}</td>
                        <td>
                          <Show
                            when={item.status !== 'resolved'}
                            fallback={<span class="muted">—</span>}
                          >
                            <button
                              type="button"
                              onClick={() => void onResolveFeedback(item)}
                              disabled={isResolvingId() === item.id}
                            >
                              {isResolvingId() === item.id ? 'Resolving…' : 'Mark resolved'}
                            </button>
                          </Show>
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  )
}
