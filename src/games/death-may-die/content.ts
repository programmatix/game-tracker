import contentText from './content.txt?raw'

export type DeathMayDieContent = {
  elderOnes: string[]
  scenarios: string[]
  investigators: string[]
  investigatorsById: Map<string, string>
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

