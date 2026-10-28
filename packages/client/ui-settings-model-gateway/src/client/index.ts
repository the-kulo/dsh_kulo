/**
 * The Model gateway settings, browser half: registers a `settings.section`
 * for the gateway routing table, expert quota, and token budget over the
 * `model-gateway-settings` namespace. The staged controller holds edits
 * until the user saves, mirroring the Model Pool pattern.
 */

// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: the ctx.configForms Context merge.
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
// Type-only: the ctx.remote Context merge and forwarded-event key face.
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import { ModelGatewaySection } from './ModelGatewaySection.tsx'
import {
  MODEL_GATEWAY_NS, ModelGatewayCardController,
} from './model-gateway-card-controller.ts'
import { en, zh, type ModelGatewayLocaleKey } from './locales.ts'

export type { ModelGatewaySectionFace, ModelGatewaySectionProps } from './ModelGatewaySection.tsx'
export type {
  ModelGatewayCardFace, ModelGatewayCardState,
  GatewayRouteEntry, GatewayExpertQuota, GatewayTokenBudget,
  GatewayZone, GatewayCategory, GatewayTier,
} from './model-gateway-card-controller.ts'
export type { ModelGatewayLocaleKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Model gateway settings page copy. */
    'settings.model-gateway': ModelGatewayLocaleKey
  }
}

/** Dictionary namespace owned by this plugin. */
export const NS = 'settings.model-gateway'

/** Required services (cordis fiber inject). */
export const inject = ['slots', 'locale', 'remote', 'remote.session', 'configForms']

/**
 * Mount the Model gateway settings page while the Host serves its namespace.
 * @param ctx - the browser plugin context.
 */
export function apply(ctx: ClientContext): void {
  const t = ctx.locale.bind(NS)
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-settings-model-gateway: dictionaries')
  const controller = new ModelGatewayCardController(
    ctx.configForms.get(MODEL_GATEWAY_NS),
    ctx,
  )
  const face = controller.inject()
  ctx.effect(() => () => { controller.dispose() }, 'ui-settings-model-gateway: gateway form')
  ctx.effect(() => ctx.configForms.whileServed([MODEL_GATEWAY_NS], () => ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'model-gateway',
    order: 45,
    label: () => t('gatewayNav'),
    locale: NS,
    inject: () => face,
  }, ModelGatewaySection))), 'ui-settings-model-gateway: model gateway section')
}
