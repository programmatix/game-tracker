import type { User } from 'firebase/auth'
import { Show, createSignal, onMount } from 'solid-js'
import { createFeedback } from './feedbackFirebase'

type Props = {
  user: User | null
  title?: string
  titleId?: string
  submitLabel?: string
  placeholder?: string
  autoFocus?: boolean
  onCancel?: () => void
  onSubmitted?: () => void
}

export default function FeedbackComposer(props: Props) {
  const [message, setMessage] = createSignal('')
  const [submitError, setSubmitError] = createSignal<string | null>(null)
  const [submitStatus, setSubmitStatus] = createSignal<string | null>(null)
  const [isSubmitting, setIsSubmitting] = createSignal(false)
  let textareaRef: HTMLTextAreaElement | undefined

  onMount(() => {
    if (props.autoFocus) {
      textareaRef?.focus()
    }
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
      props.onSubmitted?.()
    } catch (error) {
      const errorText = error instanceof Error ? error.message : String(error)
      setSubmitError(errorText || 'Failed to submit feedback.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div class="feedbackBlock">
      <h3 class="statsTitle" id={props.titleId}>
        {props.title || 'Submit feedback'}
      </h3>
      <Show when={props.user} fallback={<div class="muted">Sign in to submit feedback.</div>}>
        <form class="feedbackForm" onSubmit={onSubmitFeedback}>
          <label class="feedbackField">
            <span class="muted">Message</span>
            <textarea
              ref={textareaRef}
              class="feedbackTextarea"
              rows="4"
              placeholder={props.placeholder || 'Describe the issue or suggestion'}
              value={message()}
              onInput={(event) => setMessage(event.currentTarget.value)}
            />
          </label>
          <div class="feedbackActions">
            <button type="submit" disabled={!message().trim() || isSubmitting()}>
              {isSubmitting() ? 'Submitting…' : props.submitLabel || 'Submit feedback'}
            </button>
            <Show when={props.onCancel}>
              <button
                type="button"
                onClick={() => props.onCancel?.()}
                disabled={isSubmitting()}
              >
                Cancel
              </button>
            </Show>
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
  )
}
