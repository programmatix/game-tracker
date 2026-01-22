import { parse as parseYaml } from 'yaml'

export function parseYamlValue(text: string): unknown | null {
  try {
    return parseYaml(text)
  } catch {
    return null
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

