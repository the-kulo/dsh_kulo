/** Secure-zone history restore and derived browser observables. */

import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import type { UiWorkspace } from '@deepseek-ai/dsh-client-ui-workspace/client'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { ISessions } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
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

  /** Follow the secure-zone conversation list without creating an Agent. */
  async start(): Promise<void> {
    this.listSubscription ??= this.sessions.list.subscribe(() => { this.refresh() })
    await this.sessions.refresh().catch((error: unknown) => { this.fail(error) })
    this.refresh()
  }

  private refresh(): void {
    if (this.disposed) return
    const snapshot = this.sessions.list.getSnapshot()
    const items = [...snapshot.ids].reverse()
      .filter(id => isSecureZoneIdentity(id) || snapshot.byId[id]?.projectionValues?.agentPreset === SECURE_PRESET_ID)
      .map(id => ({ id, title: snapshot.byId[id]?.title?.trim() ?? '' }))
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
