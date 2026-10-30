/** Secure-zone history restore and derived browser observables. */

import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import type { UiWorkspace } from '@deepseek-ai/dsh-client-ui-workspace/client'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { ISessions } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { SessionSearchResultItem } from '@deepseek-ai/dsh-api-session-controller/client'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { SecureZoneKey } from './locales.ts'
import type { createSecureZoneStore } from './stores.ts'

/** Agent preset whose Sessions the panel reads; composed without tools or runtime context. */
export const SECURE_PRESET_ID = 'secure'

type SecureZoneView = ReturnType<ReturnType<typeof createSecureZoneStore>['create']>

/** One standalone secure-zone conversation in the zone's history list. */
export interface SecureZoneSessionItem {
  readonly id: SessionId
  readonly title: string
  /** Last activity (creation or latest prompt) in epoch ms; drives row order and the row's trailing relative time. */
  readonly updatedAt: number
  /**
   * No first prompt yet: the New Session placeholder row. Only the blank
   * Session the Main view retains lists — a completed one disappears on open,
   * like the Workspace browser's own blank rule.
   */
  readonly blank: boolean
  /** The Session the Main view currently retains. */
  readonly current: boolean
}

function isSecureZoneIdentity(id: SessionId): boolean {
  return id.startsWith('securezone-')
}

/** Read-only owner of the secure-zone conversation list. */
export class SecureZoneController {
  /** Standalone secure-zone conversations, newest first. */
  readonly sessionItems = createSnapshotStore<readonly SecureZoneSessionItem[]>([])

  private listSubscription: (() => void) | null = null
  private disposed = false

  constructor(
    private readonly ctx: ClientContext,
    private readonly sessions: ISessions,
    private readonly workspace: UiWorkspace,
    private readonly view: SecureZoneView,
  ) {}

  /**
   * Create one independent secure-zone Session and show it as the current
   * Main Session. `quick: true` keeps it outside every Workspace; the preset
   * id maps to the gateway's secure zone, whose routing forces the local
   * self-deployed model `LKL-GLM-5.2-FP8` and forbids external tools.
   */
  async createSession(): Promise<void> {
    const sessionId = await this.sessions.create({ quick: true, agentPreset: SECURE_PRESET_ID })
    this.workspace.openSession(sessionId)
  }

  /** Open one listed conversation as the current Main Session. */
  openSession(sessionId: SessionId): void {
    this.workspace.openSession(sessionId)
  }

  /**
   * Search conversation content on the Host, bounded like the Workspace
   * browser's search; the panel intersects the hits with its own zone list.
   * @param query - non-blank literal phrase.
   * @param signal - cancellation for a superseded search.
   * @returns bounded results, or a business/transport error.
   */
  async searchSessions(
    query: string,
    signal: AbortSignal,
  ): Promise<{ items: readonly SessionSearchResultItem[]; hasMore: boolean }> {
    const result = await this.sessions.search(query, signal)
    if (!result.ok) throw new Error(result.error.message)
    return result.value
  }

  /** Follow the secure-zone conversation list without creating an Agent. */
  async start(): Promise<void> {
    this.listSubscription ??= this.sessions.list.subscribe(() => { this.refresh() })
    await this.sessions.refresh().catch((error: unknown) => { this.fail(error) })
    this.refresh()
  }

  private refresh(): void {
    if (this.disposed) return
    const snapshot = this.sessions.list.getSnapshot()
    const current = Object.values(snapshot.byId)
      .find(session => (session.retainedBy.mainView ?? 0) > 0)?.id
    const items = [...snapshot.ids].reverse()
      .filter(id => isSecureZoneIdentity(id) || snapshot.byId[id]?.projectionValues?.agentPreset === SECURE_PRESET_ID)
      .map(id => ({
        id,
        title: snapshot.byId[id]?.title?.trim() ?? '',
        updatedAt: snapshot.byId[id]?.updatedAt ?? 0,
        blank: snapshot.byId[id]?.blank ?? false,
        current: id === current,
      }))
      .filter(item => !item.blank || item.current)
    this.sessionItems.set(items)
  }

  /** Release the list subscription. */
  dispose(): void {
    this.disposed = true
    this.listSubscription?.()
    this.listSubscription = null
  }

  private t(key: SecureZoneKey): string {
    return this.ctx.locale.bind('securezone')(key)
  }

  private fail(error: unknown): void {
    if (!this.disposed) this.view.actions.setFailures([this.t('error.offline'), error instanceof Error ? error.message : String(error)])
  }
}
