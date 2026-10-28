# Token 用量

[English](token-usage.md) | 中文

`usageDashboard` 汇总已保存的父会话和委托子会话中由提供商报告的 Token 用量。它按上海时区的日期和实际提供商/模型路由分组，并保存每会话检查点，不估算费用。[包 README](../../packages/client/ui-settings-usage/README.zh.md)负责缓存折叠和设置页展示。

## 汇总请求

省略日期范围时包含全部可用历史。`from` 和 `to` 是包含边界的上海时区日期。

```ts type-equiv
/** Inclusive Shanghai-calendar date filter. */
interface UsageSummaryRequest {
  readonly from?: string
  readonly to?: string
}
```

## 用量汇总

每天包含提供商汇总，以及每个模型的输入、缓存、输出、总 Token 和请求次数。`incomplete` 表示部分用量缺少非空实际路由。

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

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — the language sides differ only in locale-specific paired document paths. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.zh.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

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
