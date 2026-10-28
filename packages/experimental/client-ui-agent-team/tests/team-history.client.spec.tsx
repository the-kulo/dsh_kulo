// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { TeamProjection } from '@deepseek-ai/dsh-experimental-agent-team/client'
import type { SessionListState, SessionSnapshot } from '@deepseek-ai/dsh-api-session-controller/client'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import { bindSnapshotSelector, makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import { TeamHistoryView, type TeamHistoryViewProps } from '../src/client/TeamHistoryView.tsx'
import { zh } from '../src/client/locales.ts'

const SESSION = 'lead' as SessionId
const WORKER = 'worker' as SessionId
const team: TeamProjection = {
  members: [
    { id: SESSION, name: 'lead', role: 'lead', phase: 'active' },
    { id: WORKER, name: 'worker', role: 'teammate', phase: 'active' },
  ],
  tasks: [{
    id: 'task-1' as TeamProjection['tasks'][number]['id'], revision: 1,
    subject: 'Implement runtime', description: 'Build the Team runtime',
    status: 'in_progress', ownerName: 'lead', blockedBy: [], writeScopes: [], ready: false, writeScopeWarnings: [],
  }],
}

afterEach(cleanup)

function bench(projections: SessionListState['projectionsBySession'], addressed = false): TeamHistoryViewProps {
  const sessions = createSnapshotStore<SessionListState>({ ids: [], byId: {}, phase: 'ready', projectionsBySession: projections })
  const session = createSnapshotStore<SessionSnapshot>({
    sessionId: addressed ? WORKER : SESSION,
    pendingSubmissions: [], running: false,
    subagent: addressed
      ? { address: { parentSessionId: SESSION, childSessionId: WORKER, mode: 'continuable' } }
      : null,
    removed: false, openState: 'open', openError: null, hasMore: false, loadingOlder: false,
    promptError: null, blank: false, lastAgentError: null, promptAttempted: false, awaitingFirstTurn: false,
  })
  return {
    sessionId: addressed ? WORKER : SESSION,
    useSession: bindSnapshotSelector(session),
    useSessions: bindSnapshotSelector(sessions),
    useSessionStatus: bindSnapshotSelector(createSnapshotStore(new Map())),
    t: makeTranslate(zh, commonZh),
  }
}

describe('TeamHistoryView', () => {
  it('renders the Lead roster and task projection without navigation controls', () => {
    render(<TeamHistoryView {...bench({ [SESSION]: { state: 'ready', error: null, values: { agentTeam: team } } }, true)} />)
    expect(screen.getByText('Implement runtime')).toBeTruthy()
    expect(screen.getByText('Build the Team runtime')).toBeTruthy()
    expect(screen.getByText('worker')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('keeps durable failures visible and distinguishes empty from unavailable history', () => {
    const failed = { ...team, failure: 'invalid revision' }
    const { unmount } = render(<TeamHistoryView {...bench({ [SESSION]: { state: 'ready', error: null, values: { agentTeam: failed } } })} />)
    expect(screen.getByRole('alert').textContent).toContain('invalid revision')
    expect(screen.getByText('Implement runtime')).toBeTruthy()
    unmount()

    const empty = render(<TeamHistoryView {...bench({ [SESSION]: { state: 'ready', error: null, values: { agentTeam: { members: [], tasks: [] } } } })} />)
    expect(screen.getByText(zh.empty)).toBeTruthy()
    empty.unmount()

    render(<TeamHistoryView {...bench({})} />)
    expect(screen.getByRole('status').textContent).toBe(zh.unavailable)
  })
})
