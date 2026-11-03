/**
 * Client-side aggregation helpers for the usage dashboard.
 * @module @deepseek-ai/dsh-client-ui-settings-usage/client/usageAggregate
 */

import type {
  UsageDaySummary, UsageModelSummary, UsageProviderSummary, UsageTotals,
} from '../types.ts'
import { addUsage, zeroUsage } from '../usage.ts'

const DAY_MS = 86_400_000

/** Preset time-range shortcuts applied to the full recorded history. */
export type UsageRangePreset = 'today' | '7d' | '30d' | 'all' | 'custom'

/** Resolved inclusive `[from, to]` Shanghai-day bounds; `undefined` means unbounded. */
export interface UsageRange {
  readonly preset: UsageRangePreset
  readonly from?: string
  readonly to?: string
}

/** Summed totals across one or more day summaries. */
export function sumDays(days: readonly UsageDaySummary[]): UsageTotals {
  return days.reduce(addUsageSafe, zeroUsage())
}

/** Summed totals across one or more provider summaries. */
export function sumProviders(providers: readonly UsageProviderSummary[]): UsageTotals {
  return providers.reduce(addUsageSafe, zeroUsage())
}

/** Summed totals across one or more model summaries. */
export function sumModels(models: readonly UsageModelSummary[]): UsageTotals {
  return models.reduce(addUsageSafe, zeroUsage())
}

function addUsageSafe(left: UsageTotals, right: UsageTotals): UsageTotals {
  return {
    inputTokens: left.inputTokens + right.inputTokens,
    cachedTokens: left.cachedTokens + right.cachedTokens,
    outputTokens: left.outputTokens + right.outputTokens,
    totalTokens: left.totalTokens + right.totalTokens,
    requests: left.requests + right.requests,
  }
}

/**
 * Cache hit rate: `cached / (input + cached)`.
 * @returns The rate as a 0–1 fraction, or `undefined` when the denominator is zero.
 */
export function cacheHitRate(totals: UsageTotals): number | undefined {
  const denominator = totals.inputTokens + totals.cachedTokens
  if (denominator <= 0) return undefined
  return totals.cachedTokens / denominator
}

/**
 * Real consumed tokens: `input + cached + output`.
 * This matches the provider's totalTokens when the provider sums the same buckets.
 */
export function consumedTokens(totals: UsageTotals): number {
  return totals.inputTokens + totals.cachedTokens + totals.outputTokens
}

/** Filter recorded days to the given inclusive range, preserving descending order. */
export function filterDays(days: readonly UsageDaySummary[], range: UsageRange): UsageDaySummary[] {
  return days.filter(day =>
    (range.from === undefined || day.date >= range.from)
    && (range.to === undefined || day.date <= range.to),
  )
}

/**
 * Resolve a preset into concrete `from`/`to` bounds relative to today.
 * @param today - Today's Shanghai calendar day.
 * @param preset - The selected preset.
 * @param customFrom - Custom start date (used only when preset is 'custom').
 * @param customTo - Custom end date (used only when preset is 'custom').
 * @returns The resolved range.
 */
export function resolveRange(
  today: string,
  preset: UsageRangePreset,
  customFrom?: string,
  customTo?: string,
): UsageRange {
  if (preset === 'today') return { preset, from: today, to: today }
  if (preset === '7d') return { preset, from: shiftDay(today, -6), to: today }
  if (preset === '30d') return { preset, from: shiftDay(today, -29), to: today }
  if (preset === 'custom') {
    if (customFrom !== undefined && customTo !== undefined) return { preset: 'custom', from: customFrom, to: customTo }
    if (customFrom !== undefined) return { preset: 'custom', from: customFrom }
    if (customTo !== undefined) return { preset: 'custom', to: customTo }
    return { preset: 'custom' }
  }
  return { preset: 'all' }
}

/** One aggregated provider row for the selected range. */
export interface AggregatedProvider extends UsageTotals {
  readonly id: UsageProviderSummary['id']
}

/** One aggregated model row for the selected range. */
export interface AggregatedModel extends UsageTotals {
  readonly provider: string
  readonly model: string
}

/** Aggregate days into per-provider totals across the selected range. */
export function aggregateProviders(days: readonly UsageDaySummary[]): AggregatedProvider[] {
  const map = new Map<UsageProviderSummary['id'], UsageTotals & { id: UsageProviderSummary['id'] }>()
  for (const day of days) {
    for (const provider of day.providers) {
      const existing = map.get(provider.id)
      if (existing === undefined) {
        map.set(provider.id, { id: provider.id, ...addUsageSafe(zeroUsage(), provider) })
      } else {
        map.set(provider.id, { id: provider.id, ...addUsageSafe(existing, provider) })
      }
    }
  }
  return [...map.values()].sort((a, b) => a.id.localeCompare(b.id))
}

/** Aggregate days into per-model totals across the selected range. */
export function aggregateModels(days: readonly UsageDaySummary[]): AggregatedModel[] {
  const map = new Map<string, UsageTotals & { provider: string; model: string }>()
  for (const day of days) {
    for (const provider of day.providers) {
      for (const model of provider.models) {
        const key = `${model.provider}/${model.model}`
        const existing = map.get(key)
        if (existing === undefined) {
          map.set(key, { provider: model.provider, model: model.model, ...addUsageSafe(zeroUsage(), model) })
        } else {
          map.set(key, { provider: model.provider, model: model.model, ...addUsageSafe(existing, model) })
        }
      }
    }
  }
  return [...map.values()].sort((a, b) =>
    a.provider.localeCompare(b.provider) || a.model.localeCompare(b.model),
  )
}

/** Shift a `YYYY-MM-DD` date by `days` (UTC, matches Shanghai-day arithmetic). */
export function shiftDay(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00.000Z`) + days * DAY_MS).toISOString().slice(0, 10)
}

/** Collect unique "provider/model" keys from day summaries, sorted. */
export function collectModelKeys(days: readonly UsageDaySummary[]): string[] {
  const keys = new Set<string>()
  for (const day of days) {
    for (const provider of day.providers) {
      for (const model of provider.models) {
        keys.add(`${model.provider}/${model.model}`)
      }
    }
  }
  return [...keys].sort()
}

/**
 * Restrict day summaries to the selected `provider/model` keys, recomputing every total.
 * @param days Day summaries to narrow.
 * @param models Selected `provider/model` keys; an empty set keeps every model.
 * @returns Days and providers with at least one selected model, with totals summed from those models.
 */
export function filterDaysByModels(
  days: readonly UsageDaySummary[],
  models: ReadonlySet<string>,
): UsageDaySummary[] {
  if (models.size === 0) return [...days]
  const result: UsageDaySummary[] = []
  for (const day of days) {
    const providers: UsageProviderSummary[] = []
    for (const provider of day.providers) {
      const kept = provider.models.filter(model => models.has(`${model.provider}/${model.model}`))
      if (kept.length === 0) continue
      providers.push({ id: provider.id, models: kept, ...sumModels(kept) })
    }
    if (providers.length === 0) continue
    result.push({ date: day.date, providers, ...sumModels(providers.flatMap(provider => provider.models)) })
  }
  return result
}

/** ISO week string for a YYYY-MM-DD date, using Monday-based weeks. */
function isoWeek(date: string): string {
  const d = new Date(`${date}T00:00:00.000Z`)
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const year = d.getUTCFullYear()
  const week = Math.ceil(
    ((d.getTime() - Date.UTC(year, 0, 1)) / 86_400_000 + 1) / 7,
  )
  return `${year}-W${String(week).padStart(2, '0')}`
}

/** One period row for the multi-model trend chart. */
export interface AggregatedPeriod {
  readonly period: string
  readonly models: Record<string, UsageTotals>
  readonly date?: string
}

/**
 * Aggregate days by period for multi-model charting.
 * @param days Day summaries in ascending or descending order.
 * @param granularity Grouping period.
 */
export function aggregateByPeriod(
  days: readonly UsageDaySummary[],
  granularity: 'day' | 'week',
): AggregatedPeriod[] {
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date))
  const map = new Map<string, AggregatedPeriod>()
  for (const day of sorted) {
    const period = granularity === 'week' ? isoWeek(day.date) : day.date
    let entry = map.get(period)
    if (!entry) {
      entry = { period, models: {}, date: day.date }
      map.set(period, entry)
    }
    const models = entry.models
    for (const provider of day.providers) {
      for (const model of provider.models) {
        const key = `${model.provider}/${model.model}`
        models[key] = models[key] ? addUsage(models[key], model) : { ...model }
      }
    }
  }
  return [...map.values()]
}
