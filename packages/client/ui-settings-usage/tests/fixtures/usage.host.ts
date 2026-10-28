/** Real shipped-profile composition and durable usage driver. */

import { writeFile } from 'node:fs/promises'
import { createMessage } from '@deepseek-ai/dsh-llm'
import { SESSION_FORMAT_VERSION, SessionId, SessionSeq } from '@deepseek-ai/dsh-session'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-client-ui-settings-usage'
import { bootProductionProfile } from '../../../../test-support/loader-smoke/tests/fixtures/production-profile.ts'

function usageTurn(
  seq: number,
  turn: number,
  provider: string,
  model: string,
  usage: { inputTokens: number; outputTokens: number; cacheReadTokens?: number; cacheWriteTokens?: number },
): SessionEvent[] {
  const time = Date.UTC(2026, 9, 20, 18)
  const event = (offset: number): Pick<SessionEvent, 'seq' | 'time'> => ({ seq: SessionSeq(seq + offset), time })
  return [
    { ...event(0), type: 'turn/start', data: { turn } },
    { ...event(1), type: 'step/start', data: { turn, step: 1 } },
    {
      ...event(2), type: 'assistant/message', surfaceOp: 'append',
      data: {
        turn, step: 1, stream: [], usage,
        message: createMessage({ role: 'assistant', content: [], source: { kind: 'model', provider, model } }),
      },
    },
    { ...event(3), type: 'step/end', data: { turn, step: 1 } },
    { ...event(4), type: 'turn/end', data: { turn, reason: { kind: 'completed' } } },
  ]
}

const overlay = process.argv[2]
if (overlay === undefined) throw new Error('usage fixture requires its overlay')
const ctx = await bootProductionProfile({ binName: 'usage-dashboard-test', profile: 'headless', overlayPaths: [overlay] })
try {
  const parent = await ctx.sessionPersistence.create({
    version: SESSION_FORMAT_VERSION, id: SessionId('usage-parent'), createdAt: 1, isSeeded: false,
  })
  await parent.append(usageTurn(0, 1, 'kimi-coding', 'kimi-k3.1-pro', { inputTokens: 10, outputTokens: 3, cacheReadTokens: 2 }))
  await parent.flush()
  const child = await ctx.sessionPersistence.create({
    version: SESSION_FORMAT_VERSION, id: SessionId('usage-child'), createdAt: 2, isSeeded: false,
    origin: 'subagent', parentSession: SessionId('usage-parent'), delegationDepth: 1,
  })
  await child.append(usageTurn(0, 1, 'custom', 'lakala-v1', { inputTokens: 4, outputTokens: 1 }))
  await child.flush()
  const dashboard = ctx.get('usageDashboard')
  if (dashboard === undefined) throw new Error('usage dashboard did not mount through the real composition')
  const initial = await dashboard.summary({})
  await child.append(usageTurn(5, 2, 'custom', 'lakala-v1', { inputTokens: 6, outputTokens: 2, cacheWriteTokens: 1 }))
  await child.flush()
  const incremental = await dashboard.summary({})
  await writeFile('usage-summary.json', JSON.stringify({ initial, incremental }))
  await Promise.all([parent.close(), child.close()])
} finally {
  await ctx.fiber.dispose()
}
