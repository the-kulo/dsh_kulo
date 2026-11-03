/**
 * Shared geometry, palette, and ranking helpers for the usage SVG charts.
 * @module @deepseek-ai/dsh-client-ui-settings-usage/client/chartShared
 */

import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { UsageTotals } from '../types.ts'
import { consumedTokens } from './usageAggregate.ts'
import type { AggregatedPeriod } from './usageAggregate.ts'

/** Translate seat of the usage dashboard namespace. */
export type UsageTranslate = PropsLocale<'settings.usage'>['t']

/** SVG viewBox width shared by the time-series charts. */
export const VIEW_WIDTH = 760
/** SVG viewBox height shared by the time-series charts. */
export const VIEW_HEIGHT = 260
/** Left gutter reserved for y-axis labels. */
export const PADDING_LEFT = 52
/** Right gutter kept clear of the last point. */
export const PADDING_RIGHT = 16
/** Top gutter above the plot area. */
export const PADDING_TOP = 18
/** Bottom gutter reserved for x-axis labels. */
export const PADDING_BOTTOM = 30

/** Number of individually drawn series; lower ranks fold into one remainder series. */
export const MAX_SERIES = 4

/** Series palette, indexed by rank; the last entry colors the remainder series. */
export const LINE_COLORS = [
  'var(--dsw-alias-state-business-primary)',
  'var(--dsw-alias-state-success-primary)',
  'var(--dsw-alias-state-warn-primary)',
  '#8b5cf6',
  'var(--dsw-alias-label-tertiary)',
]

/** Neutral totals used when a period has no entry for a model. */
export const ZERO_USAGE: UsageTotals = {
  inputTokens: 0, cachedTokens: 0, outputTokens: 0, totalTokens: 0, requests: 0,
}

/**
 * Drop the provider prefix from a `provider/model` key for legend and axis labels.
 * @param key Provider-prefixed model key.
 * @returns The model name without its provider prefix.
 */
export function modelLabel(key: string): string {
  const idx = key.lastIndexOf('/')
  return idx === -1 ? key : key.slice(idx + 1)
}

/**
 * Rank the highest-consumption models in the given periods.
 * @param periods Aggregated periods, already scoped by range and model filter.
 * @returns The top `MAX_SERIES` model keys plus whether lower ranks were folded into one series.
 */
export function rankTopModels(
  periods: readonly AggregatedPeriod[],
): { ranked: string[]; hasOthers: boolean } {
  const totals = new Map<string, number>()
  for (const period of periods) {
    for (const [key, model] of Object.entries(period.models)) {
      totals.set(key, (totals.get(key) ?? 0) + consumedTokens(model))
    }
  }
  const all = [...totals.entries()].sort((a, b) => b[1] - a[1])
  return {
    ranked: all.slice(0, MAX_SERIES).map(entry => entry[0]),
    hasOthers: all.length > MAX_SERIES,
  }
}
