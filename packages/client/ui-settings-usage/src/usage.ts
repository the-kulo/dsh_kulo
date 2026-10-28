/** Shared Shanghai-day formatting and wire aggregation for the usage dashboard. */

import type { UsageDaySummary, UsageModelSummary, UsageProviderSummary, UsageSummary, UsageTotals } from './types.ts'

const dayFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
})

/**
 * Empty token totals.
 * @returns A new totals object with every token and request counter set to zero.
 */
export function zeroUsage(): UsageTotals {
  return { inputTokens: 0, cachedTokens: 0, outputTokens: 0, totalTokens: 0, requests: 0 }
}

/**
 * Add token totals without inferring unavailable buckets.
 * @param left Totals to use as the base.
 * @param right Totals to add to or subtract from the base.
 * @param direction Multiplier for the right-hand totals; defaults to one, and minus one removes a prior sample.
 * @returns A new totals object; neither input is modified.
 */
export function addUsage(left: UsageTotals, right: UsageTotals, direction = 1): UsageTotals {
  return {
    inputTokens: left.inputTokens + direction * right.inputTokens,
    cachedTokens: left.cachedTokens + direction * right.cachedTokens,
    outputTokens: left.outputTokens + direction * right.outputTokens,
    totalTokens: left.totalTokens + direction * right.totalTokens,
    requests: left.requests + direction * right.requests,
  }
}

/**
 * Format an epoch timestamp as its Asia/Shanghai calendar day.
 * @param time Epoch timestamp in milliseconds.
 * @returns The calendar day in `YYYY-MM-DD` format.
 */
export function shanghaiDay(time: number): string {
  const parts = Object.fromEntries(dayFormat.formatToParts(new Date(time)).map(part => [part.type, part.value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}

/**
 * Validate one ISO calendar date and return it unchanged.
 * @param value Calendar day in `YYYY-MM-DD` format.
 * @returns The validated date string.
 * @throws {TypeError} If the value is not an existing calendar day in the required format.
 */
export function requireDay(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new TypeError(`invalid calendar day "${value}"`)
  const date = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new TypeError(`invalid calendar day "${value}"`)
  }
  return value
}

/**
 * Aggregate cached per-day route rows into provider cards and daily totals.
 * @param rows Usage rows keyed by day, provider, and model.
 * @param from Optional inclusive lower calendar-day bound.
 * @param to Optional inclusive upper calendar-day bound.
 * @param incomplete Whether usage with an unavailable provider or model was omitted.
 * @returns A summary with days in descending date order and providers and model routes sorted by name.
 * @throws {TypeError} If either date bound is invalid or the range is reversed.
 */
export function summarizeUsage(
  rows: readonly (UsageModelSummary & { readonly date: string })[],
  from?: string,
  to?: string,
  incomplete = false,
): UsageSummary {
  if (from !== undefined) requireDay(from)
  if (to !== undefined) requireDay(to)
  if (from !== undefined && to !== undefined && from > to) throw new TypeError('usage date range is reversed')
  type MutableProvider = Omit<UsageProviderSummary, 'models'> & { models: UsageModelSummary[] }
  const days = new Map<string, Omit<UsageDaySummary, 'providers'> & { providers: MutableProvider[] }>()
  for (const row of rows) {
    if ((from !== undefined && row.date < from) || (to !== undefined && row.date > to)) continue
    let day = days.get(row.date)
    if (day === undefined) {
      day = { date: row.date, ...zeroUsage(), providers: [] }
      days.set(row.date, day)
    }
    Object.assign(day, addUsage(day, row))
    const family = providerFamily(row.provider, row.model)
    let provider = day.providers.find(candidate => candidate.id === family)
    if (provider === undefined) {
      provider = { id: family, ...zeroUsage(), models: [] }
      day.providers.push(provider)
    }
    Object.assign(provider, addUsage(provider, row))
    const model = provider.models.find(candidate => candidate.provider === row.provider && candidate.model === row.model)
    if (model === undefined) provider.models.push({ ...row })
    else Object.assign(model, addUsage(model, row))
  }
  for (const day of days.values()) {
    day.providers.sort((left, right) => left.id.localeCompare(right.id))
    for (const provider of day.providers) {
      provider.models.sort((left, right) => left.provider.localeCompare(right.provider) || left.model.localeCompare(right.model))
    }
  }
  return {
    timeZone: 'Asia/Shanghai',
    days: [...days.values()].sort((left, right) => right.date.localeCompare(left.date)),
    incomplete,
  }
}

/**
 * Classify named product routes while preserving their actual route in model details.
 * @param provider Provider name from the actual model route.
 * @param model Model name from the actual route.
 * @returns The matching `lakala` or `kimi` product family, or `other` for an unrecognized route.
 */
export function providerFamily(provider: string, model: string): UsageProviderSummary['id'] {
  const route = `${provider}/${model}`.toLocaleLowerCase()
  if (route.includes('lakala')) return 'lakala'
  if (route.includes('kimi') || route.includes('moonshot')) return 'kimi'
  return 'other'
}
