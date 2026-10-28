import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { SessionId } from '@deepseek-ai/dsh-session'
import { appendPluginRecord } from '@deepseek-ai/dsh-session'
import type { CreateDiscussionRoomRequest, DiscussionRoom } from '../src/index.ts'
import type { DiscussionRoomProjectionState } from '../src/projection.ts'
import { discussionRoomProjection } from '../src/projection.ts'
import { createDiscussionFixture, storedEvents, textResponse, type DiscussionFixture } from './fixture.ts'

const fixtures: DiscussionFixture[] = []
const SIGNAL = new AbortController().signal

afterEach(async () => {
  vi.restoreAllMocks()
  for (const fixture of fixtures.splice(0).reverse()) await fixture.dispose()
})

function request(overrides: Partial<CreateDiscussionRoomRequest> = {}): CreateDiscussionRoomRequest {
  return {
    topic: 'Should the team adopt a remote cache?',
    participants: [
      { name: 'Advocate', role: 'argue for adoption', provider: 'mock', model: 'model-a' },
      { name: 'Skeptic', role: 'examine risks', provider: 'mock', model: 'model-b' },
    ],
    moderator: { name: 'Moderator', provider: 'mock', model: 'model-m' },
    roundLimit: 2,
    tokenLimit: 777,
    ...overrides,
  }
}

function roomOf(agent: Agent): DiscussionRoom | null {
  let state: DiscussionRoomProjectionState = discussionRoomProjection.init(agent.session.header, agent.session.inheritedEventCount)
  for (const event of agent.session.snapshotEvents()) state = discussionRoomProjection.apply(state, event)
  if (state.failure !== undefined) throw new Error(state.failure)
  return state.room
}

async function waitStatus(agent: Agent, status: DiscussionRoom['status']): Promise<DiscussionRoom> {
  return vi.waitFor(() => {
    const room = roomOf(agent)
    expect(room?.status).toBe(status)
    return room!
  }, { timeout: 10_000 })
}

async function setup(respond: Parameters<typeof createDiscussionFixture>[0], config?: Parameters<typeof createDiscussionFixture>[1]) {
  const fixture = await createDiscussionFixture(respond, config)
  fixtures.push(fixture)
  return fixture
}

describe('discussion rooms through a real Loader composition', () => {
  it('runs opinions, bounded rebuttals, and a moderator with durable prompts, routes, and usage', async () => {
    const { ctx, lead, adapter } = await setup((options) => {
      const moderator = JSON.stringify(options.messages).includes('independent moderator')
      return textResponse(moderator ? 'Consensus and final recommendation with disagreements' : `Answer ${adapter?.requests.length ?? 0}`)
    })
    await ctx.discussionRooms.create(lead, request(), SIGNAL)
    const room = await waitStatus(lead, 'completed')

    expect(room.currentRound).toBe(2)
    expect(room.messages).toHaveLength(5)
    expect(room.messages.filter(message => message.kind === 'opinion')).toHaveLength(2)
    expect(room.messages.filter(message => message.kind === 'rebuttal')).toHaveLength(2)
    expect(room.messages.every(message => message.status === 'completed')).toBe(true)
    expect(room.messages.at(-1)).toMatchObject({ kind: 'summary', text: 'Consensus and final recommendation with disagreements' })
    expect(adapter.requests).toHaveLength(5)
    const routes = adapter.requests.map(options => [options.provider, options.model, options.maxTokens])
    expect(routes.slice(0, 4).sort()).toEqual([
      ['mock', 'model-a', 777], ['mock', 'model-a', 777], ['mock', 'model-b', 777], ['mock', 'model-b', 777],
    ])
    expect(routes.at(-1)).toEqual(['mock', 'model-m', 777])
    const rebuttal = adapter.requests.find(options => JSON.stringify(options.messages).includes('rebuttal round 2 of 2'))
    expect(JSON.stringify(rebuttal?.messages)).toContain('Transcript')
    const final = adapter.requests.at(-1)
    expect(JSON.stringify(final?.messages)).toContain('Remaining disagreements')

    const childEvents = await storedEvents(ctx, room.messages[0]!.childSessionId as SessionId)
    expect(childEvents.some(event => event.type === 'user/message' && JSON.stringify(event.data).includes('Should the team adopt a remote cache?'))).toBe(true)
    expect(childEvents.some(event => event.type === 'assistant/message' && JSON.stringify(event.data).includes('inputTokens'))).toBe(true)
    expect(childEvents.some(event => event.type === 'assistant/message' && JSON.stringify(event.data).includes('model-a'))).toBe(true)
  })

  it('retains a participant failure and still produces the final recommendation', async () => {
    let failed = false
    const { ctx, lead } = await setup(() => {
      if (!failed) {
        failed = true
        throw new Error('provider unavailable')
      }
      return textResponse('available answer')
    })
    await ctx.discussionRooms.create(lead, request({ roundLimit: 1 }), SIGNAL)
    const room = await waitStatus(lead, 'completed')
    expect(room.messages.some(message => message.status === 'failed' && message.error === 'model contribution ended with error')).toBe(true)
    expect(room.messages.at(-1)).toMatchObject({ kind: 'summary', status: 'completed', text: 'available answer' })
  })

  it('marks the room failed when the moderator fails', async () => {
    const { ctx, lead } = await setup((options) => {
      if (JSON.stringify(options.messages).includes('independent moderator')) throw new Error('moderator unavailable')
      return textResponse('participant answer')
    })
    await ctx.discussionRooms.create(lead, request({ roundLimit: 1 }), SIGNAL)
    const room = await waitStatus(lead, 'failed')
    expect(room.failure).toBe('model contribution ended with error')
    expect(room.messages.at(-1)).toMatchObject({ kind: 'summary', status: 'failed', error: 'model contribution ended with error' })
  })

  it('stops all active model work and retains the stopped room', async () => {
    const { ctx, lead, adapter } = await setup(() => 'hang')
    await ctx.discussionRooms.create(lead, request(), SIGNAL)
    await vi.waitFor(() => { expect(adapter.requests.length).toBeGreaterThan(0) })
    await ctx.discussionRooms.stop(lead)
    const room = await waitStatus(lead, 'stopped')
    expect(room.messages.length).toBeGreaterThan(0)
    expect(room.messages.every(message => message.status === 'failed' && message.error === 'contribution stopped')).toBe(true)
  })

  it('settles a stop that races the final moderator checkpoint', async () => {
    const { ctx, lead } = await setup(() => textResponse('answer'))
    let stopping = false
    const flush = ctx.sessions.flush.bind(ctx.sessions)
    vi.spyOn(ctx.sessions, 'flush').mockImplementation(async (session) => {
      const result = await flush(session)
      if (session !== lead.session || stopping) return result
      const room = roomOf(lead)
      if (room?.status === 'running' && room.messages.some(message => message.kind === 'summary' && message.status === 'completed')) {
        stopping = true
        await ctx.discussionRooms.stop(lead)
      }
      return result
    })
    await ctx.discussionRooms.create(lead, request({ roundLimit: 1 }), SIGNAL)
    const room = await waitStatus(lead, 'stopped')
    expect(stopping).toBe(true)
    expect(room.messages.at(-1)).toMatchObject({ kind: 'summary', status: 'completed' })
  })

  it('validates duplicate names and complete prompt bounds before starting children', async () => {
    const { ctx, lead, adapter } = await setup(() => textResponse('unused'), { maxPromptBytes: 1 })
    const duplicate = request()
    await expect(ctx.discussionRooms.create(lead, {
      ...duplicate,
      participants: [duplicate.participants[0]!, duplicate.participants[0]!],
    }, SIGNAL)).rejects.toThrow('duplicate participant')
    await ctx.discussionRooms.create(lead, request({ roundLimit: 1 }), SIGNAL)
    const room = await waitStatus(lead, 'failed')
    expect(adapter.requests).toHaveLength(0)
    expect(room.messages.every(message => message.error === 'discussion prompt exceeds 1 bytes')).toBe(true)
  })

  it('rejects malformed durable records in the projection', () => {
    const fixturePromise = setup(() => textResponse('unused'))
    return fixturePromise.then(async ({ lead }) => {
      appendPluginRecord(lead.session, 'plugin:discussion-room/state', { version: 1, room: null as never })
      expect(() => roomOf(lead)).toThrow('Invalid persisted discussion-room record')
      expect(lead.session.snapshotEvents().at(-1)?.ignorable).toBe(true)
    })
  })
})
