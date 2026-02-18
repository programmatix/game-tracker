export function formatPlayLength(length: string | undefined): string {
  const parsed = Number(length || '0')
  if (!Number.isFinite(parsed) || parsed <= 0) return ''

  const minutes = Math.floor(parsed)
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60

  if (hours <= 0) return `${mins}m`
  if (mins <= 0) return `${hours}h`
  return `${hours}h${String(mins).padStart(2, '0')}m`
}
