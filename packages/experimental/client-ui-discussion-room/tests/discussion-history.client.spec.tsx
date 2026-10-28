// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { UseProjection } from '@deepseek-ai/dsh-api-session-controller/client'
import type { DiscussionRoom, DiscussionRoomProjection } from '@deepseek-ai/dsh-experimental-discussion-room/client'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import { SessionId } from '@deepseek-ai/dsh-session/types'
import { DiscussionHistoryView } from '../src/client/DiscussionHistoryView.tsx'
import { zh } from '../src/client/locales.ts'

afterEach(cleanup)

function bench(projection: DiscussionRoomProjection | undefined) {
  const useProjection = (() => projection) as UseProjection
  render(<DiscussionHistoryView
    sessionId={SessionId('discussion-root')}
    useProjection={useProjection}
    t={makeTranslate(zh, commonZh)}
  />)
}

const room: DiscussionRoom = {
  id: 'room' as DiscussionRoom['id'],
  topic: '缓存方案',
  participants: [
    { id: 'p1' as DiscussionRoom['participants'][number]['id'], name: '正方', role: '支持', provider: 'custom', model: 'model-a' },
    { id: 'p2' as DiscussionRoom['participants'][number]['id'], name: '反方', role: '质疑', provider: 'custom', model: 'model-b' },
  ],
  moderator: { id: 'moderator' as DiscussionRoom['moderator']['id'], name: '主持人', provider: 'custom', model: 'model-c' },
  roundLimit: 2,
  tokenLimit: 2048,
  currentRound: 2,
  status: 'running',
  messages: [
    {
      id: 'm1' as DiscussionRoom['messages'][number]['id'],
      participantId: 'p1' as DiscussionRoom['participants'][number]['id'],
      participantName: '正方', role: '支持', provider: 'custom', model: 'model-a', round: 1,
      kind: 'opinion', status: 'completed', text: '采用缓存',
    },
    {
      id: 'm2' as DiscussionRoom['messages'][number]['id'],
      participantId: 'p2' as DiscussionRoom['participants'][number]['id'],
      participantName: '反方', role: '质疑', provider: 'custom', model: 'model-b', round: 2,
      kind: 'rebuttal', status: 'failed', error: '路由不可用',
    },
    {
      id: 'm3' as DiscussionRoom['messages'][number]['id'],
      participantId: 'moderator' as DiscussionRoom['moderator']['id'],
      participantName: '主持人', role: '总结', provider: 'custom', model: 'model-c', round: 2,
      kind: 'summary', status: 'running',
    },
  ],
}

describe('DiscussionHistoryView', () => {
  it('shows empty and durable decode-failure states', () => {
    bench(undefined)
    expect(screen.getByText('本会话还没有多模型讨论记录。')).toBeTruthy()
    cleanup()
    bench({ room: null, failure: 'Invalid persisted discussion-room record' })
    expect(screen.getByRole('alert').textContent).toContain('Invalid persisted discussion-room record')
  })

  it('renders the durable roster, progress, contributions, and failures', () => {
    bench({ room })
    expect(screen.getByRole('heading', { name: '缓存方案' })).toBeTruthy()
    expect(screen.getByText('轮次 2/2')).toBeTruthy()
    expect(screen.getByText('采用缓存')).toBeTruthy()
    expect(screen.getByText('路由不可用')).toBeTruthy()
    expect(screen.getByText('主持人最终建议')).toBeTruthy()
    expect(screen.getByText('正在生成')).toBeTruthy()
  })

  it('shows a room failure and an explicit empty message list', () => {
    bench({ room: { ...room, status: 'failed', failure: '讨论中断', messages: [] } })
    expect(screen.getByRole('alert').textContent).toBe('讨论中断')
    expect(screen.getByText('模型尚未提交观点。')).toBeTruthy()
  })
})
