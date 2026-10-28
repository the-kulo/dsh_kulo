# Daily work reports

English | [中文](daily-report.zh.md)

The experimental `dailyReports` service collects Session evidence for the configured workday window, generates sections with source links, and persists every attempt. The optional Web page is disabled independently of the Host service and its daily Schedule. The [package README](../../packages/experimental/daily-report/README.md) owns evidence collection, prompt construction, and retry behavior.

## Generation

A manual request optionally names a Shanghai-calendar date; omission selects today in the configured time zone. Scheduled generation uses the same evidence window.

```ts type-equiv
/** Manual generation input; omission selects today in the configured time zone. */
interface DailyReportGenerateRequest {
  readonly date?: string
}
```

## Stored report

Every attempt records its trigger, status, four sections, source Sessions, and optional error. `empty` means no eligible activity, so no model request occurred; `failed` does not count as a completed report.

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

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — the language sides differ only in locale-specific paired document paths. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

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
