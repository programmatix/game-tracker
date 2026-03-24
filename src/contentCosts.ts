import { getPurchaseSpreadsheetCell } from './purchaseSpreadsheet'
import { isRecord } from './yaml'

export type BoxCostConfig = {
  currencySymbol: string
  boxCostsByName: Map<string, number>
}

type RawCostValue = unknown

const SPREADSHEET_CELL_PATTERN = /^=?([A-Za-z]+[1-9]\d*)$/

function resolveSpreadsheetCellValue(reference: string): unknown {
  const match = reference.trim().match(SPREADSHEET_CELL_PATTERN)
  if (!match) return reference
  return getPurchaseSpreadsheetCell(match[1]) ?? reference
}

function resolveRawCostValue(value: RawCostValue): unknown {
  if (typeof value === 'string') return resolveSpreadsheetCellValue(value)

  if (!isRecord(value)) return value

  const referenceCandidates = [value.spreadsheetCell, value.sheetCell, value.cell]
  const reference = referenceCandidates.find((candidate) => typeof candidate === 'string')
  if (typeof reference === 'string') {
    const baseCost = coerceCost(resolveSpreadsheetCellValue(reference))
    if (baseCost === undefined) return undefined

    let resolved = baseCost

    if (typeof value.multiplier === 'number' && Number.isFinite(value.multiplier)) {
      resolved *= value.multiplier
    }

    if (typeof value.divideBy === 'number' && Number.isFinite(value.divideBy) && value.divideBy !== 0) {
      resolved /= value.divideBy
    }

    return resolved
  }

  return value.cost ?? value.price ?? value.value ?? value
}

function coerceCost(value: unknown): number | undefined {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(
            value
              .trim()
              .replace(/[,\s]/g, '')
              .replace(/^[^\d.-]+/, ''),
          )
        : Number.NaN
  if (!Number.isFinite(parsed) || parsed < 0) return undefined
  return parsed
}

class SpreadsheetBackedCostMap extends Map<string, number> {
  readonly #rawEntries: Array<readonly [string, RawCostValue]>

  constructor(entries: Array<readonly [string, RawCostValue]>) {
    super()
    this.#rawEntries = entries
  }

  #resolvedEntries(): Array<[string, number]> {
    const resolved: Array<[string, number]> = []

    for (const [box, rawCost] of this.#rawEntries) {
      const cost = coerceCost(resolveRawCostValue(rawCost))
      if (cost === undefined) continue
      resolved.push([box, cost])
    }

    return resolved
  }

  override get size(): number {
    return this.#resolvedEntries().length
  }

  override get(key: string): number | undefined {
    const entry = this.#resolvedEntries().find(([box]) => box === key)
    return entry?.[1]
  }

  override has(key: string): boolean {
    return this.get(key) !== undefined
  }

  override entries(): MapIterator<[string, number]> {
    return new Map(this.#resolvedEntries()).entries()
  }

  override keys(): MapIterator<string> {
    return new Map(this.#resolvedEntries()).keys()
  }

  override values(): MapIterator<number> {
    return new Map(this.#resolvedEntries()).values()
  }

  override forEach(
    callbackfn: (value: number, key: string, map: Map<string, number>) => void,
    thisArg?: unknown,
  ): void {
    const resolved = new Map(this.#resolvedEntries())
    resolved.forEach((value, key) => callbackfn.call(thisArg, value, key, this))
  }

  override [Symbol.iterator](): MapIterator<[string, number]> {
    return this.entries()
  }
}

function parseBoxCostMap(source: unknown): Map<string, number> {
  const entries: Array<readonly [string, RawCostValue]> = []

  if (isRecord(source)) {
    for (const [rawBox, rawCost] of Object.entries(source)) {
      const box = rawBox.trim()
      if (!box) continue
      entries.push([box, rawCost])
    }
    return new SpreadsheetBackedCostMap(entries)
  }

  if (!Array.isArray(source)) return new SpreadsheetBackedCostMap(entries)

  for (const item of source) {
    if (!isRecord(item)) continue
    const box =
      typeof item.box === 'string'
        ? item.box.trim()
        : typeof item.name === 'string'
          ? item.name.trim()
          : ''
    if (!box) continue
    entries.push([box, item.cost ?? item.price ?? item.value])
  }

  return new SpreadsheetBackedCostMap(entries)
}

export function parseBoxCostConfig(yaml: unknown): BoxCostConfig {
  if (!isRecord(yaml)) {
    return { currencySymbol: '£', boxCostsByName: new SpreadsheetBackedCostMap([]) }
  }

  const costsNode = isRecord(yaml.costs) ? yaml.costs : null

  const currencyCandidate = [
    costsNode?.currencySymbol,
    costsNode?.currency,
    yaml.currencySymbol,
    yaml.currency,
  ].find((value) => typeof value === 'string')
  const currencySymbol =
    typeof currencyCandidate === 'string' ? currencyCandidate.trim() || '£' : '£'

  const boxCostsByName = parseBoxCostMap(
    costsNode?.boxes ?? costsNode?.boxCosts ?? yaml.boxes ?? yaml.boxCosts,
  )

  return { currencySymbol, boxCostsByName }
}
