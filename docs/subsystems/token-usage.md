# Token usage

English | [中文](token-usage.zh.md)

`usageDashboard` aggregates provider-reported token usage from saved parent and delegated Sessions. It stores per-Session checkpoints and groups actual provider/model routes by Asia/Shanghai calendar day. It does not estimate prices. The [package README](../../packages/client/ui-settings-usage/README.md) owns cache folding and Settings presentation.

## Summary request

An omitted range includes all available history. `from` and `to` are inclusive Shanghai-calendar dates.

```ts type-equiv
/** Inclusive Shanghai-calendar date filter. */
interface UsageSummaryRequest {
  readonly from?: string
  readonly to?: string
}
```

## Usage summary

Each day carries provider totals and per-model input, cached, output, total, and request counts. `incomplete` reports usage that lacks a non-empty actual route.

```ts type-equiv
/** Aggregated provider usage; no prices or estimated costs. */
interface UsageSummary {
  readonly timeZone: 'Asia/Shanghai'
  readonly days: readonly UsageDaySummary[]
  /** Some provider usage could not be attributed to a non-empty actual route. */
  readonly incomplete: boolean
}
```

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — the language sides differ only in locale-specific paired document paths. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

<a id="ctxusagedashboard--usagedashboard"></a>

### `ctx.usageDashboard` — `UsageDashboard`

Host service backing the generated `usageDashboard` Remote namespace.

```ts cordis-catalog
/**
 * Aggregate actual provider usage across stored parent and delegated Sessions.
 * @param request - inclusive Shanghai-calendar date range; omitted bounds include all available history.
 * @returns daily provider/model token totals without cost estimates.
 */
@Remote('summary') async summary(request: UsageSummaryRequest): Promise<UsageSummary>
```

Source: [`packages/client/ui-settings-usage/src/index.ts`](../../packages/client/ui-settings-usage/src/index.ts)
<!-- END GENERATED cordis-surface -->
