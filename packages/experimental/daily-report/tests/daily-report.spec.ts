import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { SessionId } from '@deepseek-ai/dsh-session'
import { createDailyReportFixture, type DailyReportFixture } from './fixture.ts'

const fixtures: DailyReportFixture[] = []
afterEach(async () => {
  await Promise.all(fixtures.splice(0).map(async (fixture) => { await fixture.dispose() }))
  vi.restoreAllMocks()
})

async function fixture(root?: string) {
  const value = await createDailyReportFixture(root)
  fixtures.push(value)
  return value
}

describe('daily reports through the real Loader composition', () => {
  it('disables the Web UI while keeping the Host service and 18:00 Schedule active', async () => {
    const test = await fixture()
    const entries = [...test.ctx.loader.entries()]
    const host = entries.find(entry => entry.options.id === 'daily-report')
    const ui = entries.find(entry => entry.options.id === 'ui-daily-report')
    expect(host?.disabled).not.toBe(true)
    expect(host?.fiber).toBeDefined()
    expect(ui).toMatchObject({ disabled: true })
    expect(ui?.fiber).toBeUndefined()
    expect(await test.ctx.dailyReports.list()).toEqual([])
    expect(await test.ctx.schedule.catalog()).toHaveLength(1)
    expect((await test.ctx.schedule.catalog())[0]).toMatchObject({
      sessionId: 'daily-report', kind: 'daily', time: '18:00:00.000', timeZone: 'Asia/Shanghai', status: 'active',
    })
  })

  it('generates evidenced sections and links, persists empty days, and records model failure', async () => {
    const test = await fixture()
    const now = vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-09-16T02:00:00.000Z'))
    const source = await test.ctx.agentLoop.create(SessionId('source-session'), { provider: 'mock', model: 'source-model' })
    source.followup(createUserMessage({ content: [{ type: 'text', text: 'Implement the report parser' }], source: { kind: 'user' } }))
    await vi.waitFor(() => { expect(test.adapter.requests).toHaveLength(1) })
    now.mockRestore()

    const report = await test.ctx.dailyReports.generate({ date: '2026-09-16' })
    expect(report).toMatchObject({
      date: '2026-09-16', status: 'completed', trigger: 'manual', completed: ['Implemented the evidenced change'],
      inProgress: ['Review continues'], blocked: [], followUp: ['Verify the result'],
      sources: [{ sessionId: 'source-session', title: 'source-session' }],
    })
    expect(JSON.stringify(test.adapter.requests.at(-1)?.messages)).toContain('Implement the report parser')
    expect(test.adapter.requests.at(-1)).toMatchObject({ provider: 'mock', model: 'report-model' })

    const count = test.adapter.requests.length
    const empty = await test.ctx.dailyReports.generate({ date: '2026-09-17' })
    expect(empty).toMatchObject({ status: 'empty', sources: [] })
    expect(test.adapter.requests).toHaveLength(count)

    const brokenNow = vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-09-16T03:00:00.000Z'))
    source.followup(createUserMessage({ content: [{ type: 'text', text: 'broken output case' }], source: { kind: 'user' } }))
    await vi.waitFor(() => { expect(test.adapter.requests).toHaveLength(count + 1) })
    brokenNow.mockRestore()
    const failed = await test.ctx.dailyReports.generate({ date: '2026-09-16' })
    expect(failed).toMatchObject({ status: 'failed', sources: [{ sessionId: 'source-session' }] })
    expect(failed.error).toContain('invalid')
    expect((await test.ctx.dailyReports.list()).map(item => item.status)).toEqual(['failed', 'empty', 'completed'])
  })

  it('restores history and keeps one 18:00 Schedule across restart', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-09-17T02:00:00.000Z'))
    const root = await mkdtemp(join(tmpdir(), 'dsh-daily-report-restart-'))
    try {
      const first = await fixture(root)
      await first.ctx.dailyReports.generate({ date: '2026-09-17' })
      expect(await first.ctx.dailyReports.list()).toHaveLength(1)
      expect(await first.ctx.schedule.catalog()).toHaveLength(1)
      expect((await first.ctx.schedule.catalog())[0]).toMatchObject({
        kind: 'daily', time: '18:00:00.000', timeZone: 'Asia/Shanghai', status: 'active',
      })
      await first.dispose()
      fixtures.splice(fixtures.indexOf(first), 1)

      const second = await fixture(root)
      expect(await second.ctx.dailyReports.list()).toHaveLength(1)
      expect(await second.ctx.schedule.catalog()).toHaveLength(1)
      expect(second.adapter.requests).toHaveLength(0)
      await second.dispose()
      fixtures.splice(fixtures.indexOf(second), 1)
    } finally {
      for (const active of fixtures.splice(0)) await active.dispose()
      now.mockRestore()
      await rm(root, { recursive: true, force: true })
    }
  })
})
