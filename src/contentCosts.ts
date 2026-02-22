import { isRecord } from './yaml'

export type BoxCostConfig = {
  currencySymbol: string
  boxCostsByName: Map<string, number>
}

function coerceCost(value: unknown): number | undefined {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value.trim())
        : Number.NaN
  if (!Number.isFinite(parsed) || parsed < 0) return undefined
  return parsed
}

function parseBoxCostMap(source: unknown): Map<string, number> {
  const costs = new Map<string, number>()

  if (isRecord(source)) {
    for (const [rawBox, rawCost] of Object.entries(source)) {
      const box = rawBox.trim()
      if (!box) continue
      const cost = coerceCost(rawCost)
      if (cost === undefined) continue
      costs.set(box, cost)
    }
    return costs
  }

  if (!Array.isArray(source)) return costs

  for (const item of source) {
    if (!isRecord(item)) continue
    const box =
      typeof item.box === 'string'
        ? item.box.trim()
        : typeof item.name === 'string'
          ? item.name.trim()
          : ''
    if (!box) continue
    const cost = coerceCost(item.cost ?? item.price ?? item.value)
    if (cost === undefined) continue
    costs.set(box, cost)
  }
  return costs
}

export function parseBoxCostConfig(yaml: unknown): BoxCostConfig {
  if (!isRecord(yaml)) {
    return { currencySymbol: '£', boxCostsByName: new Map<string, number>() }
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
