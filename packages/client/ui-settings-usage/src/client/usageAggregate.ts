/**
 * Client-side aggregation helpers for the usage dashboard.
 * @module @deepseek-ai/dsh-client-ui-settings-usage/client/usageAggregate
 */

import type {
  UsageDaySummary, UsageModelSummary, UsageProviderSummary, UsageTotals,
} from '../types.ts'
import { zeroUsage } from '../usage.ts'

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
