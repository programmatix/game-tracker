export function totalPlayMinutes(
  attributes: Record<string, string>,
  quantity: number,
): number {
  const lengthMinutes = Number(attributes.length || '0')
  if (!Number.isFinite(lengthMinutes) || lengthMinutes <= 0) return 0
  const qty = Number.isFinite(quantity) && quantity > 0 ? quantity : 1
  return lengthMinutes * qty
}
