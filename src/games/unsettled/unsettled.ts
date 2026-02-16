import { getBgStatsValue, parseBgStatsKeyValueSegments, splitBgStatsSegments } from '../../bgstats'
import { unsettledContent } from './content'

export type UnsettledPlayerTags = {
  planet?: string
  task?: string
  extraTags: string[]
}

function normalizeToken(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

function normalizeId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

function normalizeTask(value: string): string | undefined {
  const token = normalizeToken(value)
  if (!token) return undefined
  const match = token.match(/(?:^|\b)(?:task\s*)?([ABC])(?:\b|$)/i)
  if (!match?.[1]) return undefined
  const upper = match[1].toUpperCase()
  return unsettledContent.tasksById.get(upper) ?? upper
}

function resolvePlanet(value: string): string | undefined {
  const token = normalizeToken(value)
  if (!token) return undefined
  const fromContent = unsettledContent.planetsById.get(normalizeId(token))
  return fromContent ?? token
}

export function parseUnsettledPlayerColor(color: string): UnsettledPlayerTags {
  const parsedKv = parseBgStatsKeyValueSegments(color)
  const tags = splitBgStatsSegments(color).filter((segment) => !/[:：]/.test(segment))

  const planetKv = getBgStatsValue(parsedKv, ['P', 'Pl', 'Planet'])
  const taskKv = getBgStatsValue(parsedKv, ['T', 'Task'])

  const planetFromKv = planetKv ? resolvePlanet(planetKv) : undefined
  const taskFromKv = taskKv ? normalizeTask(taskKv) : undefined

  const planetFromTags = tags
    .map((tag) => unsettledContent.planetsById.get(normalizeId(tag)))
    .find(Boolean)

  const taskFromTags = tags.map(normalizeTask).find(Boolean)

  let planet = planetFromKv ?? planetFromTags
  let task = taskFromKv ?? taskFromTags

  if (!planet && tags.length === 1 && !normalizeTask(tags[0]!)) {
    planet = resolvePlanet(tags[0]!)
  }

  if ((planet == null || task == null) && tags.length >= 2) {
    const first = tags[0] || ''
    const second = tags[1] || ''
    const firstTask = normalizeTask(first)
    const secondTask = normalizeTask(second)

    if (!planet) {
      if (firstTask && !secondTask) planet = resolvePlanet(second)
      else planet = resolvePlanet(first)
    }

    if (!task) {
      task = secondTask ?? (firstTask && !secondTask ? firstTask : undefined) ?? normalizeTask(second)
    }
  }

  return { planet, task, extraTags: [] }
}
