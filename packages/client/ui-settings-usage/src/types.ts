/**
 * Client-safe token usage dashboard wire types.
 * @module @deepseek-ai/dsh-client-ui-settings-usage/types
 */

/** Provider-reported token buckets. Input excludes cached prompt tokens. */
export interface UsageTotals {
  readonly inputTokens: number
  readonly cachedTokens: number
  readonly outputTokens: number
  readonly totalTokens: number
  readonly requests: number
}

/** Inclusive Shanghai-calendar date filter. */
export interface UsageSummaryRequest {
  readonly from?: string
  readonly to?: string
}

/** One actual provider/model route in the selected period. */
export interface UsageModelSummary extends UsageTotals {
  readonly provider: string
  readonly model: string
}

/** Kimi, Lakala, or the remaining routes in the selected period. */
export interface UsageProviderSummary extends UsageTotals {
  readonly id: 'kimi' | 'lakala' | 'other'
  readonly models: readonly UsageModelSummary[]
}

/** One Shanghai-calendar day of cross-Session usage. */
export interface UsageDaySummary extends UsageTotals {
  readonly date: string
  readonly providers: readonly UsageProviderSummary[]
}

/** Aggregated provider usage; no prices or estimated costs. */
export interface UsageSummary {
  readonly timeZone: 'Asia/Shanghai'
  readonly days: readonly UsageDaySummary[]
  /** Some provider usage could not be attributed to a non-empty actual route. */
  readonly incomplete: boolean
}
