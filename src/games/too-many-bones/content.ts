import contentText from './content.yaml?raw'
import { isRecord, parseYamlValue } from '../../yaml'

export type TooManyBonesContent = {
  gearlocs: string[]
  tyrants: string[]
  gearlocsById: Map<string, string>
  tyrantsById: Map<string, string>
}

type TooManyBonesYamlItem =
  | string
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

export function parseTooManyBonesContent(text: string): TooManyBonesContent {
  const yaml = parseYamlValue(text)
  if (isRecord(yaml) && Array.isArray(yaml.gearlocs) && Array.isArray(yaml.tyrants)) {
    const gearlocs: string[] = []
    const tyrants: string[] = []
    const gearlocsById = new Map<string, string>()
    const tyrantsById = new Map<string, string>()

    const applyAliases = (map: Map<string, string>, display: string, tokens: string[]) => {
      for (const token of tokens) {
        const normalized = normalizeId(token)
        if (!normalized) continue
        map.set(normalized, display)
      }
    }

    const applyItem = (item: TooManyBonesYamlItem, list: string[], map: Map<string, string>) => {
      if (typeof item === 'string') {
        const display = item.trim()
        if (!display) return
        list.push(display)
        applyAliases(map, display, [display])
        return
      }

      if (!isRecord(item) || typeof item.display !== 'string') return
      const display = item.display.trim()
      if (!display) return
      list.push(display)
      const aliases = Array.isArray(item.aliases)
        ? item.aliases.filter((alias): alias is string => typeof alias === 'string')
        : []
      applyAliases(map, display, [display, ...(typeof item.id === 'string' ? [item.id] : []), ...aliases])
    }

    for (const item of yaml.gearlocs as TooManyBonesYamlItem[]) applyItem(item, gearlocs, gearlocsById)
    for (const item of yaml.tyrants as TooManyBonesYamlItem[]) applyItem(item, tyrants, tyrantsById)

    return { gearlocs, tyrants, gearlocsById, tyrantsById }
  }

  const gearlocs: string[] = []
  const tyrants: string[] = []
  const gearlocsById = new Map<string, string>()
  const tyrantsById = new Map<string, string>()

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue
    if (line.startsWith('#')) continue

    const match = /^(?<key>G|Gearloc|C|Char|Character|T|Tyrant|Boss)\s*:\s*(?<value>.+)$/i.exec(
      line,
    )
    const key = match?.groups?.key?.toLowerCase()
    const value = match?.groups?.value ?? ''
    if (!key) continue

    const { display, id } = parseDisplayAndId(value)
    if (!display) continue

    if (key === 't' || key === 'tyrant' || key === 'boss') {
      tyrants.push(display)
      const normalizedDisplay = normalizeId(display)
      if (normalizedDisplay) tyrantsById.set(normalizedDisplay, display)
      const normalizedId = id ? normalizeId(id) : ''
      if (normalizedId) tyrantsById.set(normalizedId, display)
      continue
    }

    if (
      key === 'g' ||
      key === 'gearloc' ||
      key === 'c' ||
      key === 'char' ||
      key === 'character'
    ) {
      gearlocs.push(display)
      const normalizedDisplay = normalizeId(display)
      if (normalizedDisplay) gearlocsById.set(normalizedDisplay, display)
      const normalizedId = id ? normalizeId(id) : ''
      if (normalizedId) gearlocsById.set(normalizedId, display)
    }
  }

  return { gearlocs, tyrants, gearlocsById, tyrantsById }
}

export const tooManyBonesContent = parseTooManyBonesContent(contentText)
