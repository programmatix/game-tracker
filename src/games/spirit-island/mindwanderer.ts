export type SpiritIslandSession = {
  createdAt: string
  spirits: string[]
  adversary: string | null
  adversaryLevel: number
  endingResult: string
  raw: unknown
}

export const SPIRIT_ISLAND_MINDWANDERER_UID =
  '63df3dc9-5d7e-4f64-ad8a-a4e1dfe37004'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value != null
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function normalizeNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter((entry) => Boolean(entry))
}

export function parseSpiritIslandSessions(input: unknown): SpiritIslandSession[] {
  if (!Array.isArray(input)) return []

  const sessions: SpiritIslandSession[] = []
  for (const item of input) {
    if (!isRecord(item)) continue

    const createdAt = normalizeString(item.createdAt) ?? ''
    const endingResult = normalizeString(item.endingResult) ?? ''
    const spirits = normalizeStringArray(item.spirits)
    const adversary = normalizeString(item.adversary)
    const adversaryLevel = normalizeNumber(item.adversaryLevel) ?? -1

    if (!createdAt || !endingResult || spirits.length === 0) continue

    sessions.push({
      createdAt,
      spirits,
      adversary,
      adversaryLevel,
      endingResult,
      raw: item,
    })
  }

  return sessions
}

export async function fetchSpiritIslandSessions(
  uid: string,
  options?: { signal?: AbortSignal },
): Promise<SpiritIslandSession[]> {
  const query = new URLSearchParams({ uid })
  const response = await fetch(`/si/player/json.cgi?${query.toString()}`, {
    signal: options?.signal,
    headers: { accept: 'application/json' },
  })

  if (!response.ok) {
    throw new Error(`Spirit Island request failed: ${response.status} ${response.statusText}`)
  }

  const data: unknown = await response.json()
  return parseSpiritIslandSessions(data)
}

