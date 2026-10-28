import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { createMessage } from '@deepseek-ai/dsh-llm'
import { RetryId } from '@deepseek-ai/dsh-llm-retry'
import SessionStore from '@deepseek-ai/dsh-session'
import type { Session, SessionEvent } from '@deepseek-ai/dsh-session'
import { emptyUsageFold, foldUsageEvent } from '../src/cache.ts'
import { providerFamily, requireDay, shanghaiDay, summarizeUsage } from '../src/usage.ts'

async function events(append: (session: Session) => void): Promise<readonly SessionEvent[]> {
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  const session = ctx.sessions.create()
  append(session)
  return session.snapshotEvents()
}

function assistant(provider: string, model: string, usage = { inputTokens: 10, outputTokens: 3, cacheReadTokens: 2 }) {
  return {
    turn: 1, step: 1, stream: [], usage,
    message: createMessage({ role: 'assistant', content: [], source: { kind: 'model', provider, model } }),
  }
}

describe('usage fold', () => {
  it('uses the actual Assistant route and replaces a same-step usage sample', async () => {
    const fold = emptyUsageFold()
    const records = await events((session) => {
      session.append('request/header', { header: { config: { provider: 'configured', model: 'parent' } }, reason: 'initial' })
      session.append('assistant/attempt', {
        turn: 1, step: 1,
        stream: [{ type: 'chunk', time: 0, chunk: { type: 'usage', usage: { inputTokens: 4, outputTokens: 1 } } }],
      })
      session.append('assistant/message', assistant('kimi-coding', 'kimi-k3.1-pro'), { surfaceOp: 'append' })
    })
    for (const event of records) foldUsageEvent(fold, event)

    expect(fold.buckets).toEqual([{
      date: shanghaiDay(records.at(-1)!.time), provider: 'kimi-coding', model: 'kimi-k3.1-pro',
      inputTokens: 10, cachedTokens: 2, outputTokens: 3, totalTokens: 15, requests: 1,
    }])
    expect(fold.nextSeq).toBe(records.length)
  })

  it('retains settled retry attempts and attributes attempts to the durable request route', async () => {
    const fold = emptyUsageFold()
    const records = await events((session) => {
      session.append('request/header', { header: { config: { provider: 'custom', model: 'lakala-v1' } }, reason: 'initial' })
      session.append('assistant/attempt', {
        turn: 1, step: 1,
        stream: [{ type: 'chunk', time: 0, chunk: { type: 'usage', usage: { inputTokens: 4, outputTokens: 1 } } }],
      })
      session.append('llm/retry-started', { retryId: RetryId('usage-fold-retry'), turn: 1, step: 1, retry: 1 })
      session.append('assistant/message', assistant('custom', 'lakala-v1'), { surfaceOp: 'append' })
    })
    for (const event of records) foldUsageEvent(fold, event)

    expect(fold.buckets[0]).toMatchObject({
      provider: 'custom', model: 'lakala-v1', inputTokens: 14, outputTokens: 4, cachedTokens: 2, requests: 2,
    })
  })
})

describe('usage summary', () => {
  const rows = [{
    date: '2026-10-20', provider: 'kimi-coding', model: 'kimi-k3.1-pro',
    inputTokens: 10, cachedTokens: 2, outputTokens: 3, totalTokens: 15, requests: 1,
  }, {
    date: '2026-10-20', provider: 'custom', model: 'lakala-v1',
    inputTokens: 4, cachedTokens: 0, outputTokens: 1, totalTokens: 5, requests: 1,
  }]

  it('groups named cards, preserves model routes, and filters inclusive days', () => {
    const result = summarizeUsage(rows, '2026-10-20', '2026-10-20')
    expect(result.days).toHaveLength(1)
    expect(result.days[0]).toMatchObject({ totalTokens: 20, requests: 2 })
    expect(result.days[0]!.providers.map(provider => provider.id)).toEqual(['kimi', 'lakala'])
    expect(result.days[0]!.providers[0]!.models[0]).toMatchObject({ provider: 'kimi-coding', model: 'kimi-k3.1-pro' })
    expect(summarizeUsage(rows, '2026-10-21').days).toEqual([])
  })

  it('combines Sessions into one row per provider and model route', () => {
    const result = summarizeUsage([rows[0]!, rows[0]!])
    expect(result.days[0]!.providers[0]!.models).toHaveLength(1)
    expect(result.days[0]!.providers[0]!.models[0]).toMatchObject({
      inputTokens: 20, cachedTokens: 4, outputTokens: 6, totalTokens: 30, requests: 2,
    })
  })

  it('uses Shanghai calendar boundaries and rejects invalid ranges', () => {
    expect(shanghaiDay(Date.UTC(2026, 9, 20, 15, 59, 59))).toBe('2026-10-20')
    expect(shanghaiDay(Date.UTC(2026, 9, 20, 16, 0, 0))).toBe('2026-10-21')
    expect(providerFamily('moonshotai', 'kimi-k3')).toBe('kimi')
    expect(providerFamily('other', 'model')).toBe('other')
    expect(() => requireDay('2026-02-30')).toThrow('invalid calendar day')
    expect(() => summarizeUsage([], '2026-10-21', '2026-10-20')).toThrow('reversed')
  })
})
