/** Quick answers keeps durable preset history in a read-only sidebar region. */
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { mkdir } from 'node:fs/promises'
import type { Browser, Page } from 'playwright'
import { chromium } from 'playwright'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { SESSION_FORMAT_VERSION } from '@deepseek-ai/dsh-session'
import { createAssistantMessage, createSystemMessage, createUserMessage } from '@deepseek-ai/dsh-llm'
import {
  captureStableAria, compareOrRefreshGolden, launchWebScaffold, seedSession, watchConsole, webSnapshotMode,
  type WebScaffold,
} from './scaffold.ts'
import { connectFreshWorkspace, newEnglishPage } from './support.ts'

const EXPECTED = fileURLToPath(new URL('./expected/quick-qa-history', import.meta.url))
const MODE = webSnapshotMode()
const SEED_TIME = 1784974100000

function seedLog(): string {
  const at = (seq: number, event: Record<string, unknown>): string => JSON.stringify({ ...event, seq, time: SEED_TIME + seq })
  return [
    JSON.stringify({
      type: 'session', version: SESSION_FORMAT_VERSION, id: '{{sessionId}}',
      createdAt: SEED_TIME, cwd: '{{cwd}}/workspace', isSeeded: false, delegationDepth: 0,
    }),
    at(0, { type: 'turn/start', data: { turn: 1, trigger: { kind: 'message', source: { kind: 'user', rpcId: 'seed' } } } }),
    at(1, { type: 'step/start', data: { turn: 1, step: 1 } }),
    at(2, { type: 'system/message', data: { turn: 1, step: 1, message: createSystemMessage('') }, surfaceOp: 'append' }),
    at(3, {
      type: 'user/message',
      data: createUserMessage({ content: [{ type: 'text', text: 'Quick question' }], source: { kind: 'user', rpcId: 'seed' } }),
      surfaceOp: 'append',
    }),
    at(4, {
      type: 'assistant/message',
      data: {
        turn: 1, step: 1,
        stream: [{ type: 'text-chunks', time0: 2, index: 0, dt: [1], texts: ['Quick answer'] }],
        message: createAssistantMessage({
          content: [{ type: 'text', text: 'Quick answer' }], source: { provider: 'fixture', model: 'fixture' },
        }),
      },
      surfaceOp: 'append',
    }),
    at(5, { type: 'step/end', data: { turn: 1, step: 1 } }),
    at(6, { type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } }),
  ].join('\n')
}

describe('web e2e: Quick answers history', () => {
  let scaffold: WebScaffold
  let browser: Browser
  let page: Page
  let tripwire: ReturnType<typeof watchConsole>

  beforeAll(async () => {
    await mkdir(EXPECTED, { recursive: true })
    scaffold = await launchWebScaffold({})
    await seedSession(scaffold, seedLog(), 'quickqa-e2e', 'quick-qa')
    browser = await chromium.launch()
    page = await newEnglishPage(browser)
    tripwire = watchConsole(page)
    await page.goto(scaffold.authenticatedUrl, { waitUntil: 'load' })
  }, 120_000)

  afterAll(async () => { await browser?.close(); await scaffold?.close() })

  it('restores quick preset exchanges without a composer or model selector', async () => {
    const history = page.getByRole('region', { name: 'Quick answers', exact: true })
    await history.getByText('Quick question', { exact: true }).waitFor()
    await history.getByText('Quick answer', { exact: true }).waitFor()
    expect(await history.getByRole('textbox').count()).toBe(0)
    expect(await history.getByRole('combobox').count()).toBe(0)
    expect(await history.getByRole('button').count()).toBe(0)
    expect(scaffold.ctx.agents.list().map(agent => agent.id)).toEqual(['quickqa-e2e'])
    await compareOrRefreshGolden(join(EXPECTED, 'sidebar.expected.md'),
      await captureStableAria(page, '[aria-label="Quick answers"]', scaffold.workspaceCwd), MODE)
    expect(tripwire.pageErrors).toEqual([])
    expect(tripwire.warnings).toEqual([])
  })

  it('keeps Work mode entries out of the composer add menu', async () => {
    await connectFreshWorkspace(page, scaffold.workspaceCwd)
    await page.getByRole('button', { name: 'Add files or run commands', exact: true }).click()
    const menu = page.getByRole('listbox', { name: 'Trigger suggestions' })
    await menu.waitFor()
    for (const name of ['Agent team', 'Subagent', 'Multi-model discussion', 'Agent presets']) {
      expect(await menu.getByRole('option', { name, exact: true }).count()).toBe(0)
    }
    expect(await menu.getByText('Work mode', { exact: true }).count()).toBe(0)
    await page.keyboard.press('Escape')
  })

  it('shares the sidebar height evenly and gives each region its own scroll container', async () => {
    const history = page.getByRole('region', { name: 'Quick answers', exact: true })
    const workspace = page.getByText('Workspaces', { exact: true })
      .locator('xpath=ancestor::*[contains(@class,"sectionHeader")][1]')
      .locator('xpath=..')
    const historyBox = await history.boundingBox()
    const workspaceBox = await workspace.boundingBox()
    expect(historyBox).not.toBeNull()
    expect(workspaceBox).not.toBeNull()
    expect(Math.abs(historyBox!.height - workspaceBox!.height)).toBeLessThanOrEqual(2)
    await expect.poll(() => history.locator('[class*="history"]').first()
      .evaluate(element => getComputedStyle(element).overflowY)).toBe('auto')
    await expect.poll(() => workspace.locator('[class*="listArea"]').first()
      .evaluate(element => getComputedStyle(element).overflowY)).toBe('auto')
  })
})
