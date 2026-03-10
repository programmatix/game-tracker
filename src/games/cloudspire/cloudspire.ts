import { getBgStatsValue, parseBgStatsKeyValueSegments, splitBgStatsSegments } from '../../bgstats'
import { cloudspireContent } from './content'

export type CloudspirePlayerTags = {
  myFaction?: string
  opponentFaction?: string
  mode?: string
  soloScenario?: string
  extraTags: string[]
}

function normalizeToken(input: string): string {
  return input.trim().replace(/\s+/g, ' ')
}

function normalizeId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

function resolveFaction(value: string): string | undefined {
  const token = normalizeToken(value)
  if (!token) return undefined
  const normalized = normalizeId(token)
  const direct = cloudspireContent.factionsById.get(normalized)
  if (direct) return direct

  const withoutScenarioSuffix = normalized.replace(/s(?:cenario)?\d+$/i, '')
  if (withoutScenarioSuffix && withoutScenarioSuffix !== normalized) {
    const stripped = cloudspireContent.factionsById.get(withoutScenarioSuffix)
    if (stripped) return stripped
  }

  return token
}

function resolveMode(value: string): string | undefined {
  const token = normalizeToken(value)
  if (!token) return undefined
  return cloudspireContent.modesById.get(normalizeId(token)) ?? token
}

function resolveSoloScenario(value: string): string | undefined {
  const token = normalizeToken(value)
  if (!token) return undefined
  const normalized = normalizeId(token)
  if (!normalized) return undefined
  if (normalized === 'tutorial') return 'Tutorial'

  const numbered = normalized.match(/^(?:scenario|sc|s)?0*([0-9]{1,2})$/i)
  if (numbered) return `Scenario ${Number(numbered[1])}`

  const scenarioSuffix = normalized.match(/scenario0*([0-9]{1,2})$/i)
  if (scenarioSuffix) return `Scenario ${Number(scenarioSuffix[1])}`

  const shortSuffix = normalized.match(/s0*([0-9]{1,2})$/i)
  if (shortSuffix) return `Scenario ${Number(shortSuffix[1])}`

  return token
}

function parseFactionScenarioToken(
  value: string,
): { faction: string; soloScenario: string } | undefined {
  const token = normalizeToken(value)
  if (!token) return undefined
  const normalized = normalizeId(token)
  if (!normalized) return undefined

  const explicitScenario = normalized.match(/^(.+?)scenario0*([0-9]{1,2})$/i)
  if (explicitScenario) {
    const faction = cloudspireContent.factionsById.get(explicitScenario[1])
    if (!faction) return undefined
    return {
      faction,
      soloScenario: `Scenario ${Number(explicitScenario[2])}`,
    }
  }

  const shortScenario = normalized.match(/^(.+?)s0*([0-9]{1,2})$/i)
  if (shortScenario) {
    const faction = cloudspireContent.factionsById.get(shortScenario[1])
    if (!faction) return undefined
    return {
      faction,
      soloScenario: `Scenario ${Number(shortScenario[2])}`,
    }
  }

  return undefined
}

function isKnownFactionToken(value: string): boolean {
  return cloudspireContent.factionsById.has(normalizeId(value))
}

function isKnownModeToken(value: string): boolean {
  return cloudspireContent.modesById.has(normalizeId(value))
}

export function parseCloudspirePlayerColor(color: string): CloudspirePlayerTags {
  const parsedKv = parseBgStatsKeyValueSegments(color)
  const segments = splitBgStatsSegments(color)
  const tags = segments.filter((segment) => !/[:：]/.test(segment))
  const usedKvKeys = new Set<string>()

  const myFactionKv = getBgStatsValue(parsedKv, ['F', 'MF', 'MyFaction', 'Faction', 'Player'])
  const opponentFactionKv = getBgStatsValue(parsedKv, ['O', 'OF', 'Opponent', 'Enemy', 'Vs'])
  const modeKv = getBgStatsValue(parsedKv, ['M', 'Mode'])
  const soloScenarioKv = getBgStatsValue(parsedKv, ['S', 'Scen', 'Scenario', 'Solo'])
  if (myFactionKv) {
    for (const key of ['F', 'MF', 'MyFaction', 'Faction', 'Player']) {
      if (parsedKv[key] === myFactionKv) {
        usedKvKeys.add(key)
        break
      }
    }
  }
  if (opponentFactionKv) {
    for (const key of ['O', 'OF', 'Opponent', 'Enemy', 'Vs']) {
      if (parsedKv[key] === opponentFactionKv) {
        usedKvKeys.add(key)
        break
      }
    }
  }
  if (modeKv) {
    for (const key of ['M', 'Mode']) {
      if (parsedKv[key] === modeKv) {
        usedKvKeys.add(key)
        break
      }
    }
  }
  if (soloScenarioKv) {
    for (const key of ['S', 'Scen', 'Scenario', 'Solo']) {
      if (parsedKv[key] === soloScenarioKv) {
        usedKvKeys.add(key)
        break
      }
    }
  }

  let myFaction = myFactionKv ? resolveFaction(myFactionKv) : undefined
  let opponentFaction = opponentFactionKv ? resolveFaction(opponentFactionKv) : undefined
  let mode = modeKv ? resolveMode(modeKv) : undefined
  let soloScenario = soloScenarioKv ? resolveSoloScenario(soloScenarioKv) : undefined
  const unresolvedExpectedTags: string[] = []
  if (myFactionKv && !isKnownFactionToken(myFactionKv)) unresolvedExpectedTags.push(`F: ${myFactionKv}`)
  if (opponentFactionKv && !isKnownFactionToken(opponentFactionKv)) {
    unresolvedExpectedTags.push(`O: ${opponentFactionKv}`)
  }
  if (modeKv && !isKnownModeToken(modeKv)) unresolvedExpectedTags.push(`M: ${modeKv}`)

  const used = new Set<string>()

  for (const tag of tags) {
    const normalized = normalizeToken(tag)
    if (!normalized) continue

    const factionScenario = parseFactionScenarioToken(normalized)
    if (factionScenario) {
      if (!myFaction) myFaction = factionScenario.faction
      if (!soloScenario) soloScenario = factionScenario.soloScenario
      if (!mode) mode = 'Solo'
      used.add(normalized)
      continue
    }

    if (!mode && isKnownModeToken(normalized)) {
      mode = resolveMode(normalized)
      used.add(normalized)
      continue
    }

    if (!myFaction && isKnownFactionToken(normalized)) {
      myFaction = resolveFaction(normalized)
      used.add(normalized)
      continue
    }

    if (myFaction && isKnownFactionToken(normalized)) {
      const resolved = resolveFaction(normalized)
      if (resolved && normalizeId(resolved) === normalizeId(myFaction)) {
        used.add(normalized)
        continue
      }
    }

    if (!myFaction) {
      const resolved = resolveFaction(normalized)
      if (resolved && isKnownFactionToken(resolved)) {
        myFaction = resolved
        used.add(normalized)
        continue
      }
    }

    if (!opponentFaction && isKnownFactionToken(normalized)) {
      opponentFaction = resolveFaction(normalized)
      used.add(normalized)
      continue
    }

    if (!opponentFaction) {
      const resolved = resolveFaction(normalized)
      if (resolved && isKnownFactionToken(resolved)) {
        opponentFaction = resolved
        used.add(normalized)
        continue
      }
    }

    if (!soloScenario) {
      const resolvedScenario = resolveSoloScenario(normalized)
      if (resolvedScenario && /^(?:Tutorial|Scenario\s+[0-9]+)$/i.test(resolvedScenario)) {
        soloScenario = resolvedScenario
        used.add(normalized)
        continue
      }
    }
  }

  if (!mode) {
    const lower = tags.map((tag) => normalizeToken(tag).toLowerCase())
    if (lower.some((tag) => tag.includes('solo'))) mode = 'Solo'
    else if (lower.some((tag) => tag.includes('co-op') || tag.includes('coop'))) mode = 'Co-op'
    else if (lower.some((tag) => tag.includes('pvp') || tag === 'vs' || tag === 'versus')) mode = 'PvP'
    else if (
      tags.some((tag) => {
        const normalized = normalizeId(tag)
        return (
          normalized === 'tutorial' ||
          /s(?:cenario)?\d+$/i.test(normalized)
        )
      })
    ) {
      mode = 'Solo'
      for (const tag of tags) {
        const normalized = normalizeId(tag)
        if (normalized === 'tutorial' || /s(?:cenario)?\d+$/i.test(normalized)) {
          used.add(normalizeToken(tag))
        }
      }
    }
  }

  const extraTextTags = tags
    .map(normalizeToken)
    .filter(Boolean)
    .filter((tag) => !/^\d+(?:\.\d+)?$/.test(tag))
    .filter((tag) => !used.has(tag))

  const extraKeyValueTags = Object.entries(parsedKv)
    .filter(([key]) => !usedKvKeys.has(key))
    .map(([key, value]) => `${key}: ${normalizeToken(value)}`)
    .filter((tag) => !/[A-Za-z]+:\s*$/.test(tag))

  const extraTags = [...new Set([...extraTextTags, ...extraKeyValueTags, ...unresolvedExpectedTags])]

  if (!soloScenario && mode === 'Solo') {
    const fallbackScenario = extraTextTags.find((tag) => {
      const normalized = normalizeId(tag)
      return normalized === 'tutorial' || /^(?:scenario|sc|s)\d+$/i.test(normalized)
    })
    if (fallbackScenario) soloScenario = resolveSoloScenario(fallbackScenario)
  }

  return { myFaction, opponentFaction, mode, soloScenario, extraTags }
}
