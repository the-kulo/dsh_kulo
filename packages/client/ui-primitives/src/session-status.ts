/**
 * Session-row status precedence, shared by every sidebar zone that renders a
 * status dot. The caller maps each line's `kind` to its own locale key; the
 * ordering and the `StateDotState` mapping stay here so the workspace,
 * quick-qa, and secure-zone rows never drift apart.
 */
import type { StateDotState } from './StateDot.tsx'

/** Pending-interaction kinds a session row presents distinctly. */
export type SessionPendingKind = 'approval' | 'plan-review' | 'question'

/** Live facts one session row reads to present its status. */
export interface SessionStatusFacts {
  readonly running: boolean
  readonly runningSubagentCount: number
  readonly pendingInteraction?: SessionPendingKind
  readonly completed: boolean
}

/** One status line's stable discriminator; the caller owns its label. */
export type SessionStatusLineKind =
  | 'waitingApproval' | 'planReview' | 'waitingAnswer'
  | 'running' | 'subagentsRunning' | 'completed' | 'idle'

/** One status line in presentation order (primary first). */
export interface SessionStatusLine {
  readonly state: StateDotState
  readonly kind: SessionStatusLineKind
  /** Count carried by the `subagentsRunning` line; zero elsewhere. */
  readonly subagentCount: number
}

/* v8 ignore next 3 -- closed-union backstop; only reached if the kind is forged */
function assertNever(value: never): never {
  throw new Error(`unknown pending interaction: ${String(value)}`)
}

/**
 * Order one session row's status lines. A pending interaction is primary, live
 * activity outranks the completion reminder, and subagent activity trails the
 * session's own running state.
 * @param facts - the row's live status facts.
 * @returns one line per visible status, primary first.
 */
export function sessionStatusLines(facts: SessionStatusFacts): readonly [SessionStatusLine, ...SessionStatusLine[]] {
  const subagents: SessionStatusLine | undefined = facts.runningSubagentCount === 0
    ? undefined
    : { state: 'ongoing', kind: 'subagentsRunning', subagentCount: facts.runningSubagentCount }
  let pending: SessionStatusLine | undefined
  switch (facts.pendingInteraction) {
    case 'approval':
      pending = { state: 'warning', kind: 'waitingApproval', subagentCount: 0 }
      break
    case 'plan-review':
      pending = { state: 'warning', kind: 'planReview', subagentCount: 0 }
      break
    case 'question':
      pending = { state: 'warning', kind: 'waitingAnswer', subagentCount: 0 }
      break
    case undefined: break
    /* v8 ignore next -- closed PendingInteractionStatus union */
    default: return assertNever(facts.pendingInteraction)
  }
  if (pending !== undefined) return subagents === undefined ? [pending] : [pending, subagents]
  if (facts.running) {
    const primary: SessionStatusLine = { state: 'ongoing', kind: 'running', subagentCount: 0 }
    return subagents === undefined ? [primary] : [primary, subagents]
  }
  if (subagents !== undefined) return [subagents]
  if (facts.completed) return [{ state: 'done', kind: 'completed', subagentCount: 0 }]
  return [{ state: 'idle', kind: 'idle', subagentCount: 0 }]
}
