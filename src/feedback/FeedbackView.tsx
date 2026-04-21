import type { User } from 'firebase/auth'
import { For, Show, createEffect, createMemo, createSignal, onCleanup } from 'solid-js'
import {
  deleteFeedback,
  deleteResolvedFeedback,
  subscribeAllFeedback,
  type AdminFeedbackStatus,
  subscribeFeedbackForUser,
  type FeedbackItem,
  type FeedbackStatus,
  updateFeedbackStatus,
} from './feedbackFirebase'
import FeedbackComposer from './FeedbackComposer'

type Props = {
  user: User | null
  isAdmin: boolean
}

function formatDateTime(valueMs: number | null): string {
  if (!valueMs) return '—'
  return new Date(valueMs).toLocaleString()
}

function formatFeedbackStatus(status: FeedbackStatus): string {
  if (status === 'in-progress') return 'in progress'
  return status
}

export default function FeedbackView(props: Props) {
  const [feedbackItems, setFeedbackItems] = createSignal<FeedbackItem[]>([])
  const [allFeedbackItems, setAllFeedbackItems] = createSignal<FeedbackItem[]>([])
  const [isUpdatingStatusId, setIsUpdatingStatusId] = createSignal<string | null>(null)
  const [isDeletingId, setIsDeletingId] = createSignal<string | null>(null)
  const [isDeletingResolved, setIsDeletingResolved] = createSignal(false)
  const [confirmDeleteId, setConfirmDeleteId] = createSignal<string | null>(null)
  const [confirmDeleteResolved, setConfirmDeleteResolved] = createSignal(false)
  const [resolveError, setResolveError] = createSignal<string | null>(null)

  const visibleFeedbackItems = createMemo(() =>
    props.isAdmin ? allFeedbackItems() : feedbackItems(),
  )
  const resolvedFeedbackCount = createMemo(
    () => allFeedbackItems().filter((item) => item.status === 'resolved').length,
  )

  createEffect(() => {
    const user = props.user
    if (!user) {
      setFeedbackItems([])
      setAllFeedbackItems([])
      return
    }

    let unsubscribeMine = () => {}
    if (props.isAdmin) {
      setFeedbackItems([])
    } else {
      unsubscribeMine = subscribeFeedbackForUser(user, (items) => {
        setFeedbackItems(items)
      })
    }

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

  async function onUpdateFeedbackStatus(item: FeedbackItem, status: AdminFeedbackStatus) {
    const user = props.user
    if (!props.isAdmin || !user || item.status === status || item.status === 'resolved') return

    setResolveError(null)
    setConfirmDeleteId(null)
    setConfirmDeleteResolved(false)
    setIsUpdatingStatusId(item.id)
    try {
      await updateFeedbackStatus(item.id, status, user)
    } catch (error) {
      const errorText = error instanceof Error ? error.message : String(error)
      setResolveError(errorText || 'Failed to update feedback status.')
    } finally {
      setIsUpdatingStatusId(null)
    }
  }

  async function onDeleteFeedback(item: FeedbackItem) {
    const user = props.user
    if (!props.isAdmin || !user) return

    setResolveError(null)
    setConfirmDeleteResolved(false)
    setIsDeletingId(item.id)
    try {
      await deleteFeedback(item.id, user)
      setConfirmDeleteId(null)
    } catch (error) {
      const errorText = error instanceof Error ? error.message : String(error)
      setResolveError(errorText || 'Failed to delete feedback.')
    } finally {
      setIsDeletingId(null)
    }
  }

  async function onDeleteResolvedFeedback() {
    const user = props.user
    if (!props.isAdmin || !user) return

    setResolveError(null)
    setConfirmDeleteId(null)
    setIsDeletingResolved(true)
    try {
      await deleteResolvedFeedback(user)
      setConfirmDeleteResolved(false)
    } catch (error) {
      const errorText = error instanceof Error ? error.message : String(error)
      setResolveError(errorText || 'Failed to delete resolved feedback.')
    } finally {
      setIsDeletingResolved(false)
    }
  }

  return (
    <div class="feedbackView">
      <FeedbackComposer user={props.user} />

      <div class="feedbackBlock">
        <div class="feedbackActions">
          <h3 class="statsTitle">Feedback</h3>
          <Show when={props.isAdmin && resolvedFeedbackCount() > 0}>
            <Show
              when={confirmDeleteResolved()}
              fallback={
                <button
                  type="button"
                  onClick={() => setConfirmDeleteResolved(true)}
                  disabled={
                    isDeletingResolved() || isDeletingId() !== null || isUpdatingStatusId() !== null
                  }
                >
                  Delete all resolved ({resolvedFeedbackCount()})
                </button>
              }
            >
              <button
                type="button"
                onClick={() => void onDeleteResolvedFeedback()}
                disabled={isDeletingResolved() || isDeletingId() !== null || isUpdatingStatusId() !== null}
              >
                {isDeletingResolved() ? 'Deleting…' : 'Confirm delete resolved'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDeleteResolved(false)}
                disabled={isDeletingResolved()}
              >
                Cancel
              </button>
            </Show>
          </Show>
        </div>
        <Show when={resolveError()}>
          {(errorText) => <div class="error">{errorText()}</div>}
        </Show>
        <Show when={visibleFeedbackItems().length > 0} fallback={<div class="muted">No feedback yet.</div>}>
          <div class="tableWrap">
            <table class="table tableCompact feedbackTable">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Message</th>
                  <th>Created</th>
                  <th>Resolved</th>
                  <Show when={props.isAdmin}>
                    <th>Actions</th>
                  </Show>
                </tr>
              </thead>
              <tbody>
                <For each={visibleFeedbackItems()}>
                  {(item) => (
                    <tr>
                      <td>
                        <span
                          class="statusPill"
                          classList={{
                            statusInProgress: item.status === 'in-progress',
                            statusResolved: item.status === 'resolved',
                          }}
                        >
                          {formatFeedbackStatus(item.status)}
                        </span>
                      </td>
                      <td>{item.message}</td>
                      <td class="mono">{formatDateTime(item.createdAtMs)}</td>
                      <td class="mono">{formatDateTime(item.resolvedAtMs)}</td>
                      <Show when={props.isAdmin}>
                        <td>
                          <div class="feedbackActions">
                            <Show when={item.status === 'open'}>
                              <button
                                type="button"
                                onClick={() => void onUpdateFeedbackStatus(item, 'in-progress')}
                                disabled={
                                  isUpdatingStatusId() === item.id ||
                                  isDeletingId() === item.id ||
                                  isDeletingResolved()
                                }
                              >
                                {isUpdatingStatusId() === item.id ? 'Saving…' : 'Mark in progress'}
                              </button>
                            </Show>
                            <Show when={item.status !== 'resolved'}>
                              <button
                                type="button"
                                onClick={() => void onUpdateFeedbackStatus(item, 'resolved')}
                                disabled={
                                  isUpdatingStatusId() === item.id ||
                                  isDeletingId() === item.id ||
                                  isDeletingResolved()
                                }
                              >
                                {isUpdatingStatusId() === item.id ? 'Saving…' : 'Mark resolved'}
                              </button>
                            </Show>
                            <Show
                              when={confirmDeleteId() === item.id}
                              fallback={
                                <button
                                  type="button"
                                  onClick={() => {
                                    setConfirmDeleteResolved(false)
                                    setConfirmDeleteId(item.id)
                                  }}
                                  disabled={
                                    isDeletingId() === item.id ||
                                    isUpdatingStatusId() === item.id ||
                                    isDeletingResolved()
                                  }
                                >
                                  Delete
                                </button>
                              }
                            >
                              <button
                                type="button"
                                onClick={() => void onDeleteFeedback(item)}
                                disabled={
                                  isDeletingId() === item.id ||
                                  isUpdatingStatusId() === item.id ||
                                  isDeletingResolved()
                                }
                              >
                                {isDeletingId() === item.id ? 'Deleting…' : 'Confirm delete'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                disabled={isDeletingId() === item.id || isDeletingResolved()}
                              >
                                Cancel
                              </button>
                            </Show>
                          </div>
                        </td>
                      </Show>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </Show>
      </div>
    </div>
  )
}
