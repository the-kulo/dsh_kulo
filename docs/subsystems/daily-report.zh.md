# 工作日报

[English](daily-report.md) | 中文

实验性 `dailyReports` 服务收集配置工作时段内的会话活动，生成带来源链接的分节内容，并持久化每次尝试。可选 Web 页面可以独立禁用，不影响 Host 服务和每日定时任务。[包 README](../../packages/experimental/daily-report/README.zh.md)负责证据收集、提示构建和重试行为。

## 生成

手动请求可以指定上海时区日期；省略时选择配置时区中的今天。定时生成使用相同的证据窗口。

```ts type-equiv
/** Manual generation input; omission selects today in the configured time zone. */
interface DailyReportGenerateRequest {
  readonly date?: string
}
```

## 持久化报告

每次尝试记录触发方式、状态、四个分节、来源会话和可选错误。`empty` 表示没有符合条件的活动，因此不会调用模型；`failed` 不能视为已完成报告。

```ts type-equiv
/** One persisted daily-report generation. */
interface DailyReport {
  readonly id: string
  readonly date: string
  readonly generatedAt: string
  readonly trigger: 'manual' | 'schedule'
  readonly status: 'completed' | 'empty' | 'failed'
  readonly completed: readonly string[]
  readonly inProgress: readonly string[]
  readonly blocked: readonly string[]
  readonly followUp: readonly string[]
  readonly sources: readonly DailyReportSource[]
  readonly error?: string | undefined
}
```

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — the language sides differ only in locale-specific paired document paths. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.zh.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

<a id="ctxdailyreports--dailyreportservice"></a>

### `ctx.dailyReports` — `DailyReportService`

Host service owning report generation, durable history, and the 18:00 Schedule binding.

```ts cordis-catalog
/**
 * Read durable generation attempts without activating source Sessions.
 * @returns Generation attempts sorted newest first by generation time and identifier.
 */
@Remote('list') async list(): Promise<DailyReport[]>

/**
 * Queue one manual report and resolve only after its durable attempt commits.
 * @param request - Manual generation input with an optional local report date.
 * @returns The persisted generation attempt, including empty and failed reports.
 * @throws {Error} If the service is unavailable, the requested date is invalid, or the attempt cannot be persisted.
 */
@Remote('generate') generate(request: DailyReportGenerateRequest): Promise<DailyReport>
```

Source: [`packages/experimental/daily-report/src/index.ts`](../../packages/experimental/daily-report/src/index.ts)
<!-- END GENERATED cordis-surface -->
