/**
 * Secure-zone data-boundary enforcement shared by Session creation, resume,
 * and model selection.
 *
 * The boundary has two independent legs: the model allowlist keeps the Session
 * on a local self-deployed route, and the tool allowlist removes every tool
 * that could transmit data outside the deployment. Both apply to the secure
 * zone regardless of the agent preset the Session runs.
 *
 * @module @deepseek-ai/dsh-api-session-controller/secure-zone
 */

import type { Context } from '@deepseek-ai/cordis'
import { scopeOf } from '@deepseek-ai/dsh-scope'
// Type-only: loads the `ctx.tools` Service augmentation for the agent scope.
import type {} from '@deepseek-ai/dsh-tools'

/** Deployment-configurable secure-zone boundary policy. */
export interface SecureZonePolicy {
  /**
   * Self-deployed local model routes as `provider/model` strings, merged with
   * any model-gateway secure local route and used whenever the gateway exposes
   * none.
   */
  readonly localModels: string[]
  /** Tool allowlist for secure-zone Sessions; every other tool is removed. */
  readonly allowedTools: string[]
}

/** One exact provider/model route. */
export interface SecureModelRoute {
  readonly provider: string
  readonly model: string
}

/** Structural view of the optional model-gateway settings service. */
interface GatewaySettingsSource {
  current(): {
    readonly routing: readonly {
      readonly zone: string
      readonly tier: string
      readonly provider: string
      readonly model: string
    }[]
  }
}

/**
 * Resolve the secure-zone local model routes by merging the configured
 * self-deployed `provider/model` fallback list with any model-gateway secure
 * local route. The fallback list leads, so the first route is always a
 * configured self-deployed model even when the gateway also exposes one.
 * @param ctx - Host context that may carry the `modelGatewaySettings` service.
 * @param policy - deployment fallback and tool-allowlist policy.
 * @returns deduplicated authorized local routes.
 */
export function secureLocalRoutes(ctx: Context, policy: SecureZonePolicy): SecureModelRoute[] {
  const gateway = ctx.get('modelGatewaySettings') as GatewaySettingsSource | undefined
  const configured = gateway?.current().routing
    .filter(entry => entry.zone === 'secure' && entry.tier === 'local')
    .map(entry => ({ provider: entry.provider, model: entry.model })) ?? []
  return dedupeRoutes([...policy.localModels.flatMap(parseModelRoute), ...configured])
}

/**
 * Restrict the calling agent scope to the configured secure-zone tool
 * allowlist. Names absent from the current composition are dropped so a mode
 * that does not register a file-search tool still runs with the tools it has;
 * a dropped name narrows rather than widens the boundary.
 * @param agentCtx - unpublished or published agent scope being composed.
 * @param allowedTools - configured secure-zone tool names.
 */
export function applySecureToolAllowlist(agentCtx: Context, allowedTools: readonly string[]): void {
  const known = new Set(agentCtx.tools.definitions(scopeOf(agentCtx)).map(definition => definition.name))
  agentCtx.tools.restrict({ allow: allowedTools.filter(name => known.has(name)) })
}

function dedupeRoutes(routes: readonly SecureModelRoute[]): SecureModelRoute[] {
  const seen = new Set<string>()
  const unique: SecureModelRoute[] = []
  for (const route of routes) {
    const key = `${route.provider}\0${route.model}`
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(route)
  }
  return unique
}

function parseModelRoute(spec: string): SecureModelRoute[] {
  const slash = spec.indexOf('/')
  if (slash <= 0 || slash === spec.length - 1) return []
  return [{ provider: spec.slice(0, slash), model: spec.slice(slash + 1) }]
}
