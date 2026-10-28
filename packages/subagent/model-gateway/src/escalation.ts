/** Expert-tier escalation chain and daily quota tracking. */

import type { EscalationPolicy, RouteDecision } from './types.ts'
import { modelRouteKey } from './routing.ts'

/** Snapshot of expert-tier budget consumption for one UTC day. */
export interface ExpertBudgetSnapshot {
  /** UTC date string (YYYY-MM-DD). */
  readonly date: string
  /** Expert-model invocations recorded today. */
  readonly calls: number
  /** Total escalation steps recorded today. */
  readonly escalations: number
  /** Total expert-tier tokens recorded today. */
  readonly tokens: number
}

/** Pure-memory per-day expert quota tracker. */
export class ExpertBudgetTracker {
  private readonly snapshots = new Map<string, ExpertBudgetSnapshot>()
  private readonly taskEscalations = new Map<string, number>()

  /**
   * @param quota - Expert-tier quota enforced for every day.
   */
  constructor(private readonly quota: {
    readonly dailyCallLimit: number
    readonly maxEscalationsPerTask: number
    readonly maxContextBudgetPerRound: number
  }) {}

  /**
   * Whether a new expert escalation is permitted under the daily call limit,
   * the per-task escalation limit, and the per-round context budget.
   * @param taskId - Opaque task identity for per-task escalation counting.
   * @param date - UTC date string (YYYY-MM-DD).
   * @param contextTokens - Tokens requested for this escalation round.
   * @returns Whether the escalation is within all limits.
   */
  canEscalate(taskId: string, date: string, contextTokens: number): boolean {
    const snapshot = this.snapshots.get(date) ?? { date, calls: 0, escalations: 0, tokens: 0 }
    if (snapshot.calls >= this.quota.dailyCallLimit) return false
    if (contextTokens > this.quota.maxContextBudgetPerRound) return false
    const taskCount = this.taskEscalations.get(taskId) ?? 0
    if (taskCount >= this.quota.maxEscalationsPerTask) return false
    return true
  }

  /**
   * Record one expert escalation, incrementing daily and per-task counters.
   * @param taskId - Opaque task identity for per-task escalation counting.
   * @param date - UTC date string (YYYY-MM-DD).
   * @param contextTokens - Tokens consumed by this escalation round.
   */
  recordEscalation(taskId: string, date: string, contextTokens: number): void {
    const prev = this.snapshots.get(date) ?? { date, calls: 0, escalations: 0, tokens: 0 }
    this.snapshots.set(date, {
      date,
      calls: prev.calls + 1,
      escalations: prev.escalations + 1,
      tokens: prev.tokens + contextTokens,
    })
    this.taskEscalations.set(taskId, (this.taskEscalations.get(taskId) ?? 0) + 1)
  }

  /**
   * Read the recorded snapshot for one UTC date.
   * @param date - UTC date string (YYYY-MM-DD).
   * @returns A defensive copy of the snapshot, or a zero snapshot when none recorded.
   */
  snapshot(date: string): ExpertBudgetSnapshot {
    const found = this.snapshots.get(date)
    if (found === undefined) return { date, calls: 0, escalations: 0, tokens: 0 }
    return { ...found }
  }
}

/**
 * Advance one step along the escalation chain, enforcing expert quota.
 * @param current - The current route decision.
 * @param policy - Escalation policy for the current zone/category.
 * @param tracker - Expert budget tracker for quota enforcement.
 * @param taskId - Opaque task identity.
 * @param date - UTC date string (YYYY-MM-DD).
 * @param contextTokens - Tokens requested for the next escalation round.
 * @returns The next-route decision, or `null` when the chain is exhausted or quota is exceeded.
 */
export function nextEscalation(
  current: RouteDecision,
  policy: EscalationPolicy,
  tracker: ExpertBudgetTracker,
  taskId: string,
  date: string,
  contextTokens: number,
): RouteDecision | null {
  const currentKey = modelRouteKey({ provider: current.provider, model: current.model })
  const currentIndex = policy.chain.findIndex(route => modelRouteKey(route) === currentKey)
  if (currentIndex === -1) return null
  const nextRoute = policy.chain[currentIndex + 1]
  if (nextRoute === undefined) return null

  const nextTier = currentIndex + 1 >= policy.chain.length - 1 ? 'expert' as const : 'pool' as const
  if (nextTier === 'expert') {
    if (!tracker.canEscalate(taskId, date, contextTokens)) return null
    tracker.recordEscalation(taskId, date, contextTokens)
  }

  const escalation = [...current.escalation, nextRoute]
  return {
    provider: nextRoute.provider,
    model: nextRoute.model,
    tier: nextTier,
    zone: current.zone,
    category: current.category,
    requiresApproval: current.requiresApproval,
    escalation,
  }
}
