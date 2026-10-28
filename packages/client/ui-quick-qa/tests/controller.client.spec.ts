import { describe, expect, it, vi } from 'vitest'
import { createAssistantMessage, createUserMessage } from '@deepseek-ai/dsh-llm'
import { SessionSeq, type SessionEvent, type SessionId } from '@deepseek-ai/dsh-session/types'
import { MutableSessionEventSource, type SessionEventLikeEntry } from '@deepseek-ai/dsh-api-session-controller/client'
import { QuickQaController } from '../src/client/controller.ts'
import { createQuickQaStore } from '../src/client/stores.ts'

const QUICK_ID = 'quickqa-main' as SessionId
const ORDINARY_ID = 'session-quick-qa' as SessionId
const OTHER_ID = 'session-standard' as SessionId

function entry(event: SessionEvent): SessionEventLikeEntry {
  return { type: 'event', event }
}

function durableEntries(): SessionEventLikeEntry[] {
  return [
    entry({ type: 'turn/start', seq: SessionSeq(0), time: 1, data: { turn: 1 } }),
    entry({
      type: 'user/message', seq: SessionSeq(1), time: 2, surfaceOp: 'append',
      data: createUserMessage({ content: [{ type: 'text', text: 'Question' }], source: { kind: 'user' } }),
    }),
    entry({
      type: 'user/message', seq: SessionSeq(2), time: 2, surfaceOp: 'append',
      data: {
        ...createUserMessage({ content: [{ type: 'text', text: 'Current working directory: /project' }], source: { kind: 'user' } }),
        source: { kind: 'runtime-context', form: 'snapshot', sections: [{ name: 'working-directory:current', text: 'Current working directory: /project' }] } as never,
      },
    }),
    entry({
      type: 'assistant/message', seq: SessionSeq(3), time: 3, surfaceOp: 'append',
      data: {
        turn: 1,
        step: 1,
        stream: [{ type: 'text-chunks', time0: 2, index: 0, dt: [1], texts: ['Answer'] }],
        message: createAssistantMessage({
          content: [{ type: 'text', text: 'Answer' }], source: { provider: 'fixture', model: 'fixture' },
        }),
      },
    }),
    entry({ type: 'turn/end', seq: SessionSeq(4), time: 4, data: { turn: 1, reason: { kind: 'completed' } } }),
  ]
}

function summary(id: SessionId, agentPreset?: string) {
  return {
    id,
    displayTitle: id,
    running: false,
    retainedBy: [],
    blank: false,
    updatedAt: 0,
    ...(agentPreset === undefined ? {} : { projectionValues: { agentPreset } }),
  }
}

function harness(rows: { ids: SessionId[]; byId?: Partial<Record<SessionId, ReturnType<typeof summary>>> }) {
  const eventSource = new MutableSessionEventSource()
  eventSource.replace(durableEntries(), false)
  const reference = {
    binding: { eventSource, session: {} },
    ready: Promise.resolve(),
    release: vi.fn(),
  }
  const retain = vi.fn(() => reference)
  const refresh = vi.fn(async () => {})
  let list = rows.ids
  const listeners = new Set<() => void>()
  const sessions = {
    list: {
      getSnapshot: () => ({
        ids: list,
        byId: Object.fromEntries(list.map(id => [id, rows.byId?.[id] ?? summary(id)])),
      }),
      subscribe: (listener: () => void) => {
        listeners.add(listener)
        return () => { listeners.delete(listener) }
      },
    },
    refresh,
    retain,
  }
  const ctx = {
    locale: { bind: () => (key: string) => key },
    logger: { warn: vi.fn() },
  }
  const view = createQuickQaStore().create()
  const controller = new QuickQaController(ctx as never, sessions as never, view)
  return {
    controller, view, retain, refresh, reference, eventSource,
    setList: (ids: SessionId[]) => {
      list = ids
      for (const listener of listeners) listener()
    },
  }
}

describe('QuickQaController', () => {
  it('restores nothing and creates no Agent when the catalog holds no quick-answer history', async () => {
    const b = harness({ ids: [] })

    await b.controller.start()

    expect(b.refresh).toHaveBeenCalledOnce()
    expect(b.retain).not.toHaveBeenCalled()
    expect(b.controller.exchanges.getSnapshot()).toEqual([])
    b.controller.dispose()
    expect(b.reference.release).not.toHaveBeenCalled()
  })

  it('attaches a quick-answer Session that first appears after the empty restoration', async () => {
    const b = harness({ ids: [], byId: { [ORDINARY_ID]: summary(ORDINARY_ID, 'quick-qa') } })
    await b.controller.start()

    b.setList([ORDINARY_ID])

    await vi.waitFor(() => { expect(b.retain).toHaveBeenCalledWith(ORDINARY_ID, { source: 'quickQaPanel' }) })
    expect(b.controller.exchanges.getSnapshot()).toMatchObject([{ question: 'Question', answer: 'Answer' }])
    b.controller.dispose()
  })

  it('restores the quickqa-* identity and folds its durable exchanges without creating anything', async () => {
    const b = harness({ ids: [QUICK_ID] })

    await b.controller.start()

    expect(b.retain).toHaveBeenCalledWith(QUICK_ID, { source: 'quickQaPanel' })
    expect(b.controller.exchanges.getSnapshot()).toMatchObject([{ question: 'Question', answer: 'Answer', active: false }])
    b.controller.dispose()
    expect(b.reference.release).toHaveBeenCalledOnce()
  })

  it('restores an ordinary Session created with the quick-qa preset through its projection values', async () => {
    const b = harness({ ids: [OTHER_ID, ORDINARY_ID], byId: { [ORDINARY_ID]: summary(ORDINARY_ID, 'quick-qa') } })

    await b.controller.start()

    expect(b.retain).toHaveBeenCalledWith(ORDINARY_ID, { source: 'quickQaPanel' })
    b.controller.dispose()
  })

  it('keeps one settled restore across reloads instead of racing a second open', async () => {
    const b = harness({ ids: [QUICK_ID] })

    await Promise.all([b.controller.start(), b.controller.start()])
    b.setList([ORDINARY_ID, QUICK_ID])
    await b.controller.start()

    expect(b.retain).toHaveBeenCalledOnce()
    b.controller.dispose()
  })

  it('prefers the newest listed quick-answer Session', async () => {
    const b = harness({ ids: [QUICK_ID, ORDINARY_ID], byId: { [ORDINARY_ID]: summary(ORDINARY_ID, 'quick-qa') } })

    await b.controller.start()

    expect(b.retain).toHaveBeenCalledWith(ORDINARY_ID, { source: 'quickQaPanel' })
    b.controller.dispose()
  })

  it('reports a restore failure through the history store and can retry', async () => {
    const b = harness({ ids: [QUICK_ID] })
    b.refresh.mockRejectedValueOnce(new Error('offline'))

    await expect(b.controller.start()).rejects.toThrow('offline')
    expect(b.view.getSnapshot().failures).toEqual(['error.offline', 'offline'])

    await b.controller.start()
    expect(b.controller.exchanges.getSnapshot()).toHaveLength(1)
    b.controller.dispose()
  })
})
