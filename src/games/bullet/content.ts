import contentText from './content.yaml?raw'
import { isRecord, parseYamlValue } from '../../yaml'

export type BulletContent = {
  heroines: string[]
  bosses: string[]
  heroinesById: Map<string, string>
  bossesById: Map<string, string>
}

type BulletYamlItem =
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

export function parseBulletContent(text: string): BulletContent {
  const yaml = parseYamlValue(text)
  if (isRecord(yaml) && Array.isArray(yaml.heroines) && Array.isArray(yaml.bosses)) {
    const heroines: string[] = []
    const bosses: string[] = []
    const heroinesById = new Map<string, string>()
    const bossesById = new Map<string, string>()

    const applyAliases = (map: Map<string, string>, display: string, tokens: string[]) => {
      for (const token of tokens) {
        const normalized = normalizeId(token)
        if (!normalized) continue
        map.set(normalized, display)
      }
    }

    const applyItem = (item: BulletYamlItem, list: string[], map: Map<string, string>) => {
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

    for (const item of yaml.heroines as BulletYamlItem[]) applyItem(item, heroines, heroinesById)
    for (const item of yaml.bosses as BulletYamlItem[]) applyItem(item, bosses, bossesById)

    return { heroines, bosses, heroinesById, bossesById }
  }

  const heroines: string[] = []
  const bosses: string[] = []
  const heroinesById = new Map<string, string>()
  const bossesById = new Map<string, string>()

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue
    if (line.startsWith('#')) continue

    const match = /^(?<key>H|Heroine|HeroineId|C|Char|Character|B|Boss)\s*:\s*(?<value>.+)$/i.exec(
      line,
    )
    const key = match?.groups?.key?.toLowerCase()
    const value = match?.groups?.value ?? ''
    if (!key) continue

    const { display, id } = parseDisplayAndId(value)
    if (!display) continue

    if (key === 'b' || key === 'boss') {
      bosses.push(display)
      const normalizedDisplay = normalizeId(display)
      if (normalizedDisplay) bossesById.set(normalizedDisplay, display)
      const normalizedId = id ? normalizeId(id) : ''
      if (normalizedId) bossesById.set(normalizedId, display)
      continue
    }

    if (
      key === 'h' ||
      key === 'heroine' ||
      key === 'heroineid' ||
      key === 'c' ||
      key === 'char' ||
      key === 'character'
    ) {
      heroines.push(display)
      const normalizedDisplay = normalizeId(display)
      if (normalizedDisplay) heroinesById.set(normalizedDisplay, display)
      const normalizedId = id ? normalizeId(id) : ''
      if (normalizedId) heroinesById.set(normalizedId, display)
    }
  }

  return { heroines, bosses, heroinesById, bossesById }
}

export const bulletContent = parseBulletContent(contentText)
