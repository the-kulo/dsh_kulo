/** Quick answers history restore and derived browser observables. */

import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { ISessions, SessionReference } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import { quickQaExchanges, type QuickQaExchangeView } from './transcript.ts'
import type { QuickQaKey } from './locales.ts'
import type { createQuickQaStore } from './stores.ts'

/** Agent preset whose Sessions the panel reads; composed without tools or runtime context. */
export const QUICK_QA_PRESET_ID = 'quick-qa'
const REFERENCE = { source: 'quickQaPanel' } as const

type QuickQaView = ReturnType<ReturnType<typeof createQuickQaStore>['create']>

function isQuickQaIdentity(id: SessionId): boolean {
  return id.startsWith('quickqa-')
}

/** Read-only owner of the latest quick-answer Session and the panel's derived sources. */
export class QuickQaController {
  /** Durable exchanges rendered by the panel. */
  readonly exchanges = createSnapshotStore<readonly QuickQaExchangeView[]>([])

  private reference: SessionReference | null = null
  private sessionId: SessionId | null = null
  private sessionOpening: Promise<SessionId | null> | null = null
  private listSubscription: (() => void) | null = null
  private disposed = false
  private readonly subscriptions: (() => void)[] = []

  constructor(
    private readonly ctx: ClientContext,
    private readonly sessions: ISessions,
    private readonly view: QuickQaView,
  ) {}

  /** Follow quick-answer history without creating an Agent. */
  async start(): Promise<void> {
    this.listSubscription ??= this.sessions.list.subscribe(() => {
      void this.restore().catch((error: unknown) => { this.fail(error) })
    })
    await this.restore(true)
  }

  private latestQuickQaId(): SessionId | undefined {
    const snapshot = this.sessions.list.getSnapshot()
    return [...snapshot.ids].reverse().find((id) => {
      if (isQuickQaIdentity(id)) return true
      return snapshot.byId[id]?.projectionValues?.agentPreset === QUICK_QA_PRESET_ID
    })
  }

  /** Attach the latest quick-answer Session; the absence of history is the empty state, not a failure. */
  private async restore(refresh = false): Promise<SessionId | null> {
    if (this.disposed) return null
    this.sessionOpening ??= this.openSession(refresh)
    let completed = false
    try {
      const sessionId = await this.sessionOpening
      completed = true
      return sessionId
    } finally {
      this.sessionOpening = null
      if (completed && (this.latestQuickQaId() ?? null) !== this.sessionId) await this.restore()
    }
  }

  private async openSession(refresh: boolean): Promise<SessionId | null> {
    try {
      if (refresh) await this.sessions.refresh()
      const sessionId = this.latestQuickQaId()
      if (sessionId === this.sessionId) return sessionId
      if (sessionId === undefined) {
        for (const unsubscribe of this.subscriptions.splice(0)) unsubscribe()
        this.reference?.release()
        this.reference = null
        this.sessionId = null
        this.exchanges.set([])
        this.view.actions.setFailures([])
        return null
      }
      const reference = this.sessions.retain(sessionId, REFERENCE)
      try {
        await reference.ready
      } catch (error: unknown) {
        reference.release()
        throw error
      }
      if (this.disposed) {
        reference.release()
        throw new Error('Quick answers was disposed while its Session opened')
      }
      for (const unsubscribe of this.subscriptions.splice(0)) unsubscribe()
      this.reference?.release()
      this.reference = reference
      const binding = reference.binding
      const updateEvents = (): void => {
        this.exchanges.set(quickQaExchanges(binding.eventSource.getSnapshot().entries))
      }
      this.subscriptions.push(binding.eventSource.subscribe(updateEvents))
      this.sessionId = sessionId
      this.view.actions.setFailures([])
      updateEvents()
      return sessionId
    } catch (error: unknown) {
      this.fail(error)
      throw error
    }
  }

  /** Release subscriptions and the retained Session. */
  dispose(): void {
    this.disposed = true
    this.listSubscription?.()
    this.listSubscription = null
    for (const unsubscribe of this.subscriptions.splice(0)) unsubscribe()
    this.reference?.release()
    this.reference = null
  }

  private t(key: QuickQaKey): string {
    return this.ctx.locale.bind('quickqa')(key)
  }

  private failureLine(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
  }

  private fail(error: unknown): void {
    if (!this.disposed) this.view.actions.setFailures([this.t('error.offline'), this.failureLine(error)])
  }
}
