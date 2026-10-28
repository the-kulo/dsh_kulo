import type { SessionId } from '@deepseek-ai/dsh-session'

/** A Session that supplied activity to a daily report. */
export interface DailyReportSource {
  readonly sessionId: SessionId
  readonly title: string
}

/** One persisted daily-report generation. */
export interface DailyReport {
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

/** Manual generation input; omission selects today in the configured time zone. */
export interface DailyReportGenerateRequest {
  readonly date?: string
}
