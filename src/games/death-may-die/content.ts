import contentText from './content.yaml?raw'
import { isRecord, parseYamlValue } from '../../yaml'

export type DeathMayDieContent = {
  elderOnes: string[]
  scenarios: string[]
  investigators: string[]
  investigatorsById: Map<string, string>
}

type DeathMayDieYamlItem =
  | string
  | number
  | {
      display: string
      id?: string
      aliases?: string[]
    }

function normalizeId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

function parseDisplayAndId(raw: string): { display: string; id?: string } {
  const match = /^(?<display>.*?)(?:\s*\[(?<id>[^\]]+)\])?\s*$/i.exec(raw.trim())
  const display = (match?.groups?.display ?? raw).trim().replace(/\s+/g, ' ')
  const id = match?.groups?.id?.trim()
  return { display, id: id || undefined }
}

export function parseDeathMayDieContent(text: string): DeathMayDieContent {
  const yaml = parseYamlValue(text)
  if (
    isRecord(yaml) &&
    Array.isArray(yaml.elderOnes) &&
    Array.isArray(yaml.scenarios) &&
    Array.isArray(yaml.investigators)
  ) {
    const elderOnes: string[] = []
    const scenarios: string[] = []
    const investigators: string[] = []
    const investigatorsById = new Map<string, string>()

    const applyAliases = (map: Map<string, string>, display: string, tokens: string[]) => {
      for (const token of tokens) {
        const normalized = normalizeId(token)
        if (!normalized) continue
        map.set(normalized, display)
      }
    }

    for (const item of yaml.elderOnes as DeathMayDieYamlItem[]) {
      if (typeof item !== 'string') continue
      const display = item.trim()
      if (!display) continue
      elderOnes.push(display)
    }

    for (const item of yaml.scenarios as DeathMayDieYamlItem[]) {
      const raw =
        typeof item === 'number'
          ? String(item)
          : typeof item === 'string'
            ? item
            : isRecord(item) && typeof item.display === 'string'
              ? item.display
              : ''
      const trimmed = raw.trim()
      if (!trimmed) continue
      const normalized =
        /^scenario\b/i.test(trimmed)
          ? trimmed
          : /^\\d+$/.test(trimmed)
            ? `Scenario ${trimmed}`
            : trimmed
      scenarios.push(normalized)
    }

    for (const item of yaml.investigators as DeathMayDieYamlItem[]) {
      if (typeof item === 'string') {
        const display = item.trim()
        if (!display) continue
        investigators.push(display)
        applyAliases(investigatorsById, display, [display])
        continue
      }

      if (!isRecord(item) || typeof item.display !== 'string') continue
      const display = item.display.trim()
      if (!display) continue
      investigators.push(display)
      const aliases = Array.isArray(item.aliases)
        ? item.aliases.filter((alias): alias is string => typeof alias === 'string')
        : []
      applyAliases(investigatorsById, display, [display, ...(typeof item.id === 'string' ? [item.id] : []), ...aliases])
    }

    return { elderOnes, scenarios, investigators, investigatorsById }
  }

  const elderOnes: string[] = []
  const scenarios: string[] = []
  const investigators: string[] = []
  const investigatorsById = new Map<string, string>()

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue
    if (line.startsWith('#')) continue

    const match =
      /^(?<key>EO|ElderOne|Elder One|S|Scenario|I|Inv|Investigator|C|Char|Character)\s*:\s*(?<value>.+)$/i.exec(
        line,
      )
    const key = match?.groups?.key?.toLowerCase()
    const value = match?.groups?.value ?? ''
    if (!key) continue

    const { display, id } = parseDisplayAndId(value)
    if (!display) continue

    if (key === 'eo' || key === 'elderone' || key === 'elder one') {
      elderOnes.push(display)
      continue
    }

    if (key === 's' || key === 'scenario') {
      const trimmed = display.trim()
      const normalized =
        /^scenario\b/i.test(trimmed) ? trimmed : /^\\d+$/.test(trimmed) ? `Scenario ${trimmed}` : trimmed
      scenarios.push(normalized)
      continue
    }

    if (
      key === 'i' ||
      key === 'inv' ||
      key === 'investigator' ||
      key === 'c' ||
      key === 'char' ||
      key === 'character'
    ) {
      investigators.push(display)
      const normalizedId = normalizeId(id ?? display)
      if (normalizedId) investigatorsById.set(normalizedId, display)
    }
  }

  return { elderOnes, scenarios, investigators, investigatorsById }
}

export const deathMayDieContent = parseDeathMayDieContent(contentText)
