import { For, Show } from 'solid-js'

export type CampaignProgressStep = {
  key: string
  label: string
  plays: number
  wins?: number
  hours: number
  hasAssumedHours: boolean
  playIds: readonly number[]
}

export type CampaignProgressSection = {
  key: string
  label: string
  group?: string
  summary?: string
  playIds?: readonly number[]
  steps: readonly CampaignProgressStep[]
}

export default function CampaignProgressTable(props: {
  title: string
  stepLabel: string
  sections: readonly CampaignProgressSection[]
  emptyText?: string
  onCampaignPlaysClick?: (campaignKey: string) => void
  onStepPlaysClick?: (campaignKey: string, stepKey: string) => void
}) {
  return (
    <div class="statsBlock">
      <h3 class="statsTitle">{props.title}</h3>
      <Show
        when={props.sections.length > 0}
        fallback={<div class="muted">{props.emptyText ?? 'No campaign data yet.'}</div>}
      >
        <div class="tableWrap compact">
          <table class="table compactTable mobileCardTable">
            <thead>
              <tr>
                <th>{props.stepLabel}</th>
                <th class="mono">Played</th>
                <th class="mono">Plays</th>
                <th class="mono">Wins</th>
                <th class="mono">Hours</th>
                <th class="mono">Avg / play</th>
              </tr>
            </thead>
            <tbody>
              <For each={props.sections}>
                {(section, index) => {
                  const previousGroup = () =>
                    index() > 0 ? props.sections[index() - 1]?.group?.trim() ?? '' : ''
                  const currentGroup = () => section.group?.trim() ?? ''
                  const shouldRenderGroupHeader = () =>
                    currentGroup().length > 0 && currentGroup() !== previousGroup()

                  return (
                    <>
                      <Show when={shouldRenderGroupHeader()}>
                        <tr>
                          <th class="heatmapRowGroupHead" colSpan={6}>
                            {currentGroup()}
                          </th>
                        </tr>
                      </Show>
                      <tr>
                        <th class="campaignProgressCampaignHead" colSpan={6}>
                          <div class="campaignProgressCampaignRow">
                            <Show
                              when={props.onCampaignPlaysClick && (section.playIds?.length ?? 0) > 0}
                              fallback={<span>{section.label}</span>}
                            >
                              <button
                                type="button"
                                class="countLink campaignProgressCampaignButton"
                                onClick={() => props.onCampaignPlaysClick?.(section.key)}
                                title="View campaign plays"
                              >
                                {section.label}
                              </button>
                            </Show>
                            <Show when={section.summary}>
                              <span class="campaignProgressCampaignSummary mono muted">
                                {section.summary}
                              </span>
                            </Show>
                          </div>
                        </th>
                      </tr>
                      <For each={section.steps}>
                        {(step) => {
                          const avgHours = step.plays > 0 ? step.hours / step.plays : 0
                          return (
                            <tr>
                              <td data-label={props.stepLabel}>{step.label}</td>
                              <td class="mono" data-label="Played">
                                {step.plays > 0 ? '✓' : ''}
                              </td>
                              <td class="mono" data-label="Plays">
                                <Show
                                  when={props.onStepPlaysClick && step.playIds.length > 0}
                                  fallback={step.plays.toLocaleString()}
                                >
                                  <button
                                    type="button"
                                    class="countLink"
                                    onClick={() => props.onStepPlaysClick?.(section.key, step.key)}
                                    title="View plays"
                                  >
                                    {step.plays.toLocaleString()}
                                  </button>
                                </Show>
                              </td>
                              <td class="mono" data-label="Wins">
                                {(step.wins ?? 0).toLocaleString()}
                              </td>
                              <td class="mono" data-label="Hours">
                                {step.hours.toLocaleString(undefined, {
                                  minimumFractionDigits: 1,
                                  maximumFractionDigits: 1,
                                })}
                                {step.hasAssumedHours ? '*' : ''}
                              </td>
                              <td class="mono" data-label="Avg / play">
                                <Show when={step.plays > 0} fallback="—">
                                  {avgHours.toLocaleString(undefined, {
                                    minimumFractionDigits: 1,
                                    maximumFractionDigits: 1,
                                  })}
                                  {step.hasAssumedHours ? '*' : ''}
                                </Show>
                              </td>
                            </tr>
                          )
                        }}
                      </For>
                    </>
                  )
                }}
              </For>
            </tbody>
          </table>
        </div>
      </Show>
    </div>
  )
}
