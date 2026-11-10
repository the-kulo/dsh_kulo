/** Quick-answer history retention over the cold Sessions of the quick-qa zone. */

import type { Context } from '@deepseek-ai/cordis'
import type { SessionHeader, SessionId } from '@deepseek-ai/dsh-session'

/** Milliseconds in one day; the retention window is a whole number of days. */
const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Internal scheduling constant, not deployment configuration: how often the
 * retention sweep runs. The window is days, so a six-hour sweep keeps the
 * history tidy without listing the whole session store continuously.
 */
const SWEEP_INTERVAL_MS = 6 * 60 * 60 * 1000

/** Projection key whose `lastPromptAt` marks a Session's last activity. */
const ACTIVITY_PROJECTION_KEYS = ['sessionListMetadata'] as const

/** Owns the periodic removal of cold quick-answer Sessions past their window. */
export class QuickQaRetention {
  private sweeping: Promise<void> | undefined

  /**
   * @param ctx - Host context carrying Session, persistence, and projection-cache services.
   * @param quickQaDir - Absolute quick-answer zone directory identifying its Sessions.
   * @param retentionDays - Positive whole days a cold quick-answer Session is kept.
   * @param remove - Authoritative Session deletion owned by the Session Controller.
   */
  constructor(
    private readonly ctx: Context,
    private readonly quickQaDir: string,
    private readonly retentionDays: number,
    private readonly remove: (sessionId: SessionId) => Promise<unknown>,
  ) {}

  /**
   * Start the periodic sweep and run one sweep once persistence and the
   * projection cache are available, so the first sweep dates activity from the
   * cache instead of the creation-time floor.
   */
  start(): void {
    const ctx = this.ctx
    ctx.effect(() => {
      const timer = setInterval(() => { void this.sweepInBackground() }, SWEEP_INTERVAL_MS)
      return () => clearInterval(timer)
    }, 'sessionController.quickQaRetention')
    ctx.inject(['sessionPersistence', 'sessionProjectionCache'], () => { void this.sweepInBackground() })
  }

  /**
   * Remove every cold, unarchived quick-answer Session whose last activity is
   * older than the retention window. Re-entrant: a sweep already running is
   * joined, not repeated.
   * @param now - Current epoch milliseconds; overridable by direct tests.
   * @returns after the sweep settles.
   */
  async runSweep(now = Date.now()): Promise<void> {
    if (this.sweeping !== undefined) return this.sweeping
    this.sweeping = this.doSweep(now).finally(() => { this.sweeping = undefined })
    return this.sweeping
  }

  private async sweepInBackground(): Promise<void> {
    try {
      await this.runSweep()
    } catch (error: unknown) {
      this.ctx.logger.warn(`quick-qa retention: sweep failed: ${String(error)}`)
    }
  }

  private async doSweep(now: number): Promise<void> {
    const persistence = this.ctx.get('sessionPersistence')
    if (persistence === undefined) return
    const cutoff = now - this.retentionDays * DAY_MS
    const archived = new Set(this.ctx.workspaceRegistry.archivedSessionIds)
    for (const { header } of await persistence.list()) {
      if (!this.isQuickQaSession(header)) continue
      // An opened Session is in use; it becomes eligible only once it is cold.
      if (this.ctx.sessions.get(header.id) !== undefined) continue
      // An archived Session is explicitly kept out of the default view.
      if (archived.has(header.id)) continue
      if (this.lastActivityAt(header) >= cutoff) continue
      try {
        await this.remove(header.id)
      } catch (error: unknown) {
        this.ctx.logger.warn(
          `quick-qa retention: failed to remove expired session "${header.id}": ${String(error)}`,
        )
      }
    }
  }

  /**
   * Whether one stored Session belongs to the quick-answer history: a Session
   * the zone placed in the quick-qa directory, or a legacy Session whose
   * current Agent preset is still `quick-qa` (the client's zone fallback).
   * @param header - stored Session header.
   * @returns true when the Session appears in the quick-qa sidebar.
   */
  private isQuickQaSession(header: SessionHeader): boolean {
    if (header.cwd === this.quickQaDir) return true
    return this.ctx.get('sessionProjectionCache')
      ?.cachedSnapshot(header, ['agentPreset'])?.values.agentPreset === 'quick-qa'
  }

  /**
   * Read one Session's last activity: its latest user prompt when the projection
   * cache holds it, otherwise its creation time.
   * @param header - stored Session header.
   * @returns epoch milliseconds of the last known activity.
   */
  private lastActivityAt(header: SessionHeader): number {
    try {
      const metadata = this.ctx.get('sessionProjectionCache')
        ?.cachedSnapshot(header, ACTIVITY_PROJECTION_KEYS)
        ?.values.sessionListMetadata
      return Math.max(header.createdAt, metadata?.lastPromptAt ?? 0)
    } catch (error: unknown) {
      // A cache that is still initializing must not block retention; creation
      // time is the durable floor.
      this.ctx.logger.debug(
        `quick-qa retention: activity lookup for "${header.id}" failed: ${String(error)}`,
      )
      return header.createdAt
    }
  }
}
