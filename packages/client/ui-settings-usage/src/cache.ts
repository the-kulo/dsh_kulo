/** Durable per-Session usage fold and disposable cache declaration. */

import { z } from 'zod'
import { brandString } from '@deepseek-ai/dsh-brand'
import type { TokenUsage } from '@deepseek-ai/dsh-llm/types'
import type {} from '@deepseek-ai/dsh-llm-retry/types'
import type { SessionEvent, SessionHeader, SessionId, SessionLogOffset } from '@deepseek-ai/dsh-session'
import type { DomainSpec } from '@deepseek-ai/dsh-storage-domain'
import { addUsage, shanghaiDay } from './usage.ts'
import type { UsageModelSummary, UsageTotals } from './types.ts'

const totalsSchema = z.object({
  inputTokens: z.number().int().nonnegative(),
  cachedTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative(),
  requests: z.number().int().nonnegative(),
}).strict()

const routeSchema = z.object({ provider: z.string().min(1), model: z.string().min(1) }).strict()
const bucketSchema = totalsSchema.extend({ date: z.string(), provider: z.string(), model: z.string() }).strict()
const lastSchema = z.object({
  turn: z.number().int().nonnegative(), step: z.number().int().nonnegative(),
  bucket: bucketSchema,
}).strict()

/** Incremental per-Session checkpoint; aggregate rows are rebuildable from the log. */
export const usageCacheRecord = z.object({
  identity: z.object({
    createdAt: z.number().int().nonnegative(), cwd: z.string().optional(), isSeeded: z.boolean(),
    inheritedEventCount: z.number().int().nonnegative(),
  }).strict(),
  revision: z.string(),
  nextSeq: z.number().int().nonnegative(),
  requestRoute: routeSchema.nullable(),
  last: lastSchema.nullable(),
  buckets: z.array(bucketSchema),
  incomplete: z.boolean(),
}).strict()

/** One cached Session fold. */
export type UsageCacheRecord = z.infer<typeof usageCacheRecord>
/** Mutable fold state used while rebuilding a checkpoint. */
export type UsageFold = Omit<UsageCacheRecord, 'identity' | 'revision'>

/** Per-Session documents prevent one dashboard refresh from rewriting the whole cache. */
export const usageCacheDomain = {
  name: 'token_usage_dashboard',
  version: 1,
  layout: 'per-record',
  invalidRecords: 'backup-and-skip',
  tables: {
    sessions: { valueSchema: usageCacheRecord, __key: brandString<SessionId>('sessions') },
  },
} satisfies DomainSpec

/**
 * Start an empty fold after any inherited fork prefix already counted in its ancestor.
 * @param nextSeq Sequence number of the next event to read; defaults to zero.
 * @returns A fold with no request route, usage sample, aggregate rows, or omitted usage.
 */
export function emptyUsageFold(nextSeq = 0): UsageFold {
  return { nextSeq, requestRoute: null, last: null, buckets: [], incomplete: false }
}

/**
 * Check the lifecycle fields that prevent a recreated Session id reusing old usage.
 * @param record Cached usage whose identity should be checked.
 * @param header Current Session lifecycle metadata.
 * @param inheritedEventCount Number of events inherited from the Session's ancestor.
 * @returns Whether every cached identity field matches the current Session lifecycle.
 */
export function cacheIdentityMatches(
  record: UsageCacheRecord,
  header: SessionHeader,
  inheritedEventCount: SessionLogOffset,
): boolean {
  return record.identity.createdAt === header.createdAt
    && record.identity.cwd === header.cwd
    && record.identity.isSeeded === header.isSeeded
    && record.identity.inheritedEventCount === inheritedEventCount
}

/**
 * Bind a fold to its authoritative log lifecycle and revision.
 * @param fold Aggregated usage state to checkpoint.
 * @param header Current Session lifecycle metadata.
 * @param inheritedEventCount Number of events inherited from the Session's ancestor.
 * @param revision Log revision at which the fold was complete.
 * @returns A durable checkpoint containing a deep copy of the fold.
 */
export function usageCacheCheckpoint(
  fold: UsageFold,
  header: SessionHeader,
  inheritedEventCount: SessionLogOffset,
  revision: string,
): UsageCacheRecord {
  return {
    identity: {
      createdAt: header.createdAt, ...header.cwd === undefined ? {} : { cwd: header.cwd },
      isSeeded: header.isSeeded, inheritedEventCount,
    },
    revision,
    ...structuredClone(fold),
  }
}

/** Extract the actual successful-message route, including delegated Sessions. */
function messageRoute(event: SessionEvent<'assistant/message'>): { provider: string; model: string } | undefined {
  const { provider, model } = event.data.message.source
  return provider.length > 0 && model.length > 0 ? { provider, model } : undefined
}

function usageOf(event: SessionEvent): TokenUsage | undefined {
  if (event.type === 'assistant/message' && event.data.usage !== undefined) return event.data.usage
  if (event.type !== 'assistant/message' && event.type !== 'assistant/attempt') return undefined
  for (let index = event.data.stream.length - 1; index >= 0; index -= 1) {
    const record = event.data.stream[index]
    if (record?.type === 'chunk' && record.chunk.type === 'usage') return record.chunk.usage
  }
  return undefined
}

function tokensOf(usage: TokenUsage): UsageTotals {
  const cachedTokens = (usage.cacheReadTokens ?? 0) + (usage.cacheWriteTokens ?? 0)
  return {
    inputTokens: usage.inputTokens,
    cachedTokens,
    outputTokens: usage.outputTokens,
    totalTokens: usage.inputTokens + cachedTokens + usage.outputTokens,
    requests: 1,
  }
}

function applyBucket(fold: UsageFold, bucket: UsageCacheRecord['buckets'][number], direction: number): void {
  const index = fold.buckets.findIndex(candidate => candidate.date === bucket.date
    && candidate.provider === bucket.provider && candidate.model === bucket.model)
  if (index < 0) {
    if (direction > 0) fold.buckets.push(structuredClone(bucket))
    return
  }
  const current = fold.buckets[index]
  if (current === undefined) throw new Error('usage bucket index missing')
  const next = { date: bucket.date, provider: bucket.provider, model: bucket.model, ...addUsage(current, bucket, direction) }
  if (next.requests === 0) fold.buckets.splice(index, 1)
  else fold.buckets[index] = next
}

/**
 * Fold one durable event using token-meter's last-sample/retry accounting semantics.
 * @param fold Mutable usage state to update.
 * @param event Durable Session event to apply.
 * @returns Nothing; the fold is updated in place.
 */
export function foldUsageEvent(fold: UsageFold, event: SessionEvent): void {
  if (event.type === 'request/header') {
    const { provider, model } = event.data.header.config
    fold.requestRoute = provider.length > 0 && model.length > 0 ? { provider, model } : null
  }
  if (event.type === 'llm/retry-started') {
    if (fold.last?.turn === event.data.turn && fold.last.step === event.data.step) fold.last = null
  }
  const usage = usageOf(event)
  if (usage === undefined) {
    fold.nextSeq = event.seq + 1
    return
  }
  if (event.type !== 'assistant/message' && event.type !== 'assistant/attempt') return
  const route = event.type === 'assistant/message' ? messageRoute(event) : fold.requestRoute
  if (route === undefined || route === null) {
    fold.incomplete = true
    fold.nextSeq = event.seq + 1
    return
  }
  const { turn, step } = event.data
  if (fold.last?.turn === turn && fold.last.step === step) applyBucket(fold, fold.last.bucket, -1)
  const bucket = {
    date: shanghaiDay(event.time), provider: route.provider, model: route.model, ...tokensOf(usage),
  }
  applyBucket(fold, bucket, 1)
  fold.last = { turn, step, bucket }
  fold.nextSeq = event.seq + 1
}

/**
 * Flatten checkpoint rows for the shared wire aggregator.
 * @param records Cached Session folds to flatten.
 * @returns Every cached day/provider/model row in record and bucket iteration order.
 */
export function cachedUsageRows(records: Iterable<UsageCacheRecord>): (UsageModelSummary & { date: string })[] {
  return [...records].flatMap(record => record.buckets)
}
