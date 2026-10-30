/** Quick answers history restore and derived browser observables. */

import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import type { UiWorkspace } from '@deepseek-ai/dsh-client-ui-workspace/client'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { ISessions } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { QuickQaKey } from './locales.ts'
import type { createQuickQaStore } from './stores.ts'

/** Agent preset whose Sessions the panel reads; composed without tools or runtime context. */
export const QUICK_QA_PRESET_ID = 'quick-qa'

type QuickQaView = ReturnType<ReturnType<typeof createQuickQaStore>['create']>

/** One standalone quick-answer conversation in the zone's history list. */
export interface QuickQaSessionItem {
  readonly id: SessionId
  readonly title: string
  /** Last update epoch ms from the Session list summary; drives the row's relative time. */
  readonly updatedAt: number
  /** A blank Session has no first prompt yet; its row shows the New Session label and no time. */
  readonly blank: boolean
}

function isQuickQaIdentity(id: SessionId): boolean {
  return id.startsWith('quickqa-')
}

/** Read-only owner of the quick-answer zone's conversation list. */
export class QuickQaController {
  /** Standalone quick-answer conversations, newest first. */
  readonly sessionItems = createSnapshotStore<readonly QuickQaSessionItem[]>([])

  private listSubscription: (() => void) | null = null
  private disposed = false

  constructor(
    private readonly ctx: ClientContext,
    private readonly sessions: ISessions,
    private readonly workspace: UiWorkspace,
    private readonly view: QuickQaView,
  ) {}

  /**
   * Create one independent quick-answer Session and show it as the current
   * Main Session. `quick: true` keeps it outside every Workspace; the preset
   * id maps to the gateway's quick-qa zone for model routing.
   */
  async createSession(): Promise<void> {
    const sessionId = await this.sessions.create({ quick: true, agentPreset: QUICK_QA_PRESET_ID })
    this.workspace.openSession(sessionId)
  }

  /** Open one listed conversation as the current Main Session. */
  openSession(sessionId: SessionId): void {
    this.workspace.openSession(sessionId)
  }

  /** Follow the quick-answer conversation list without creating an Agent. */
  async start(): Promise<void> {
    this.listSubscription ??= this.sessions.list.subscribe(() => { this.refresh() })
    await this.sessions.refresh().catch((error: unknown) => { this.fail(error) })
    this.refresh()
  }

  private refresh(): void {
    if (this.disposed) return
    const snapshot = this.sessions.list.getSnapshot()
    const items = [...snapshot.ids].reverse()
      .filter(id => isQuickQaIdentity(id) || snapshot.byId[id]?.projectionValues?.agentPreset === QUICK_QA_PRESET_ID)
      .map((id): QuickQaSessionItem => {
        const summary = snapshot.byId[id]
        return {
          id,
          title: summary?.title?.trim() ?? '',
          updatedAt: summary?.updatedAt ?? 0,
          blank: summary?.blank ?? false,
        }
      })
    this.sessionItems.set(items)
  }

  /** Release the list subscription. */
  dispose(): void {
    this.disposed = true
    this.listSubscription?.()
    this.listSubscription = null
  }

  private t(key: QuickQaKey): string {
    return this.ctx.locale.bind('quickqa')(key)
  }

  private fail(error: unknown): void {
    if (!this.disposed) this.view.actions.setFailures([this.t('error.offline'), error instanceof Error ? error.message : String(error)])
  }
}
