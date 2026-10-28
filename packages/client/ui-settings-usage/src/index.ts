/**
 * Cross-Session provider token usage with durable incremental checkpoints and a Host Remote API.
 * @module @deepseek-ai/dsh-client-ui-settings-usage
 */

import { Context, Service } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type {} from '@deepseek-ai/dsh-session-persistence'
import type {} from '@deepseek-ai/dsh-storage-domain'
import type { KvTable } from '@deepseek-ai/dsh-storage-domain'
import type { SessionId } from '@deepseek-ai/dsh-session'
import type { SessionPersistenceSnapshot } from '@deepseek-ai/dsh-session-persistence'
import {
  cacheIdentityMatches, cachedUsageRows, emptyUsageFold, foldUsageEvent, usageCacheCheckpoint, usageCacheDomain,
} from './cache.ts'
import type { UsageCacheRecord, UsageFold } from './cache.ts'
import { summarizeUsage } from './usage.ts'
import type { UsageSummary, UsageSummaryRequest } from './types.ts'

export type * from './types.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Host owner of cross-Session token usage summaries. */
    usageDashboard: UsageDashboard
  }
}

/** Host service backing the generated `usageDashboard` Remote namespace. */
export class UsageDashboard extends TypertRemoteService {
  static inject = ['sessionPersistence', 'storageDomain', 'typert']

  private table?: KvTable<SessionId, UsageCacheRecord>
  private refreshChain: Promise<void> = Promise.resolve()

  /** @param ctx - Host context carrying persistence, cache storage, and Typert. */
  constructor(ctx: Context) {
    super(ctx, 'usageDashboard', { namespace: 'usageDashboard' })
  }

  protected async [Service.init](): Promise<void> {
    const domain = await this.ctx.storageDomain.open(usageCacheDomain)
    this.ctx.effect(() => () => domain.close(), 'usageDashboard.domainClose')
    this.table = domain.table('sessions')
  }

  /**
   * Aggregate actual provider usage across stored parent and delegated Sessions.
   * @param request - inclusive Shanghai-calendar date range; omitted bounds include all available history.
   * @returns daily provider/model token totals without cost estimates.
   */
  @Remote('summary')
  async summary(request: UsageSummaryRequest): Promise<UsageSummary> {
    summarizeUsage([], request.from, request.to)
    const refresh = this.refreshChain.then(() => this.refresh())
    this.refreshChain = refresh.catch(() => {})
    await refresh
    const records = [...this.requireTable().entries()].map(([, record]) => record)
    return summarizeUsage(cachedUsageRows(records), request.from, request.to, records.some(record => record.incomplete))
  }

  private async refresh(): Promise<void> {
    const snapshots = await this.ctx.sessionPersistence.list()
    for (const snapshot of snapshots) await this.refreshSession(snapshot)
    const live = new Set<SessionId>(snapshots.map(snapshot => snapshot.header.id))
    const table = this.requireTable()
    const deleted = [...table.keys()].filter(id => !live.has(id))
    if (deleted.length > 0) await table.deleteMany(deleted)
  }

  private async refreshSession(snapshot: SessionPersistenceSnapshot): Promise<void> {
    const table = this.requireTable()
    const id = snapshot.header.id
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const cached = table.get(id)
      if (cached?.revision === snapshot.revision) return
      const handle = await this.ctx.sessionPersistence.open(id, 'read')
      let fold: UsageFold
      try {
        fold = cached !== undefined && cacheIdentityMatches(cached, handle.header, handle.inheritedEventCount)
          ? structuredClone(cached)
          : emptyUsageFold(handle.inheritedEventCount)
        while (true) {
          const page = await handle.read(fold.nextSeq, 1000)
          if (page.events.length === 0) break
          for (const event of page.events) foldUsageEvent(fold, event)
        }
      } finally {
        await handle.close()
      }
      const settled = await this.ctx.sessionPersistence.stat(id)
      if (settled === undefined) {
        if (cached !== undefined) await table.delete(id)
        return
      }
      if (settled.revision !== snapshot.revision) {
        snapshot = settled
        continue
      }
      const checkpoint = usageCacheCheckpoint(fold, handle.header, handle.inheritedEventCount, settled.revision)
      await table.put(id, checkpoint)
      return
    }
    throw new Error(`token usage dashboard: Session "${id}" kept changing during three refresh attempts`)
  }

  private requireTable(): KvTable<SessionId, UsageCacheRecord> {
    /* v8 ignore next -- Service.init assigns the table before the service becomes injectable */
    if (this.table === undefined) throw new Error('usage dashboard is not initialized')
    return this.table
  }
}

export default UsageDashboard
