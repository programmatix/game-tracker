import contentText from './content.txt?raw'

export type BulletContent = {
  heroines: string[]
  bosses: string[]
  heroinesById: Map<string, string>
  bossesById: Map<string, string>
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
