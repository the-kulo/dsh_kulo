/**
 * Agent-team Conversation-view tab registration. The tab rides the
 * shell-owned `conversation.view` slot like Chat and Trajectory and renders
 * the Lead Session's `agentTeam` projection read-only.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import { TeamHistoryView } from './TeamHistoryView.tsx'
import { en, ja, es, fr, de, ru, pt, NS, zh, type TeamKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Agent Teams roster, task-board, and history-tab copy. */
    'agent-team': TeamKey
  }
}

/** Required browser services for slots and localized copy. */
export const inject = ['slots', 'locale']

/**
 * Register the Team locale dictionaries and the history view tab. The tab
 * reads the Lead Session's `agentTeam` projection from the shared Session
 * store; this registration performs no Team RPC.
 * @param ctx - Client Context carrying the injected locale and slot services.
 */
export function registerAgentTeamUi(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en, ja, es, fr, de, ru, pt }), 'client-ui-agent-team: dictionaries')
  const t = ctx.locale.bind(NS)
  ctx.slots.inject('conversation.view', () => ctx.slots.register({
    name: 'conversation.view',
    id: 'agent-team',
    order: 20,
    locale: NS,
    label: () => t('tab.label'),
  }, TeamHistoryView))
}
