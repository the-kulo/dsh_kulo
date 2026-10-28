/** Core gateway routing: zone × category → model route decision. */

import { assertNever } from './assert-never.ts'
import type {
  AllowedModelRoute,
  GatewayTaskCategory,
  RouteDecision,
  RoutingPolicy,
  Zone,
} from './types.ts'

/** Self-deployed local model id for sensitive and test tasks. */
const LOCAL_MODEL_ID = 'LKL-GLM-5.2-FP8'

/**
 * Stable identity for one provider/model pair.
 * @param route - Exact provider/model route.
 * @returns Opaque key for equality checks.
 */
export function modelRouteKey(route: AllowedModelRoute): string {
  return `${route.provider}\0${route.model}`
}

/**
 * Find the first authorized local route whose model id is {@link LOCAL_MODEL_ID}.
 * @param policy - Zone routing policy with local route authorization.
 * @returns The authorized local route, or `undefined` when absent.
 */
function findLocalRoute(policy: RoutingPolicy, zone: Zone): AllowedModelRoute | undefined {
  const zonePolicy = policy.zones.find(entry => entry.zone === zone)
  if (zonePolicy === undefined) return undefined
  return zonePolicy.localRoutes.find(route => route.model === LOCAL_MODEL_ID)
}

/**
 * Find the first authorized pool route matching one of the candidate model ids.
 * @param policy - Zone routing policy with pool route authorization.
 * @param zone - Zone to resolve pool routes under.
 * @param candidateModelIds - Acceptable model ids in priority order.
 * @returns The first matching authorized pool route, or `undefined`.
 */
function findPoolRoute(
  policy: RoutingPolicy,
  zone: Zone,
  candidateModelIds: readonly string[],
): AllowedModelRoute | undefined {
  const zonePolicy = policy.zones.find(entry => entry.zone === zone)
  if (zonePolicy === undefined) return undefined
  for (const modelId of candidateModelIds) {
    const match = zonePolicy.poolRoutes.find(route => route.model === modelId)
    if (match !== undefined) return match
  }
  return undefined
}

/**
 * Resolve the workspace-zone pool route for one category.
 * @param category - Task category.
 * @param policy - Routing policy.
 * @returns The pool route, or `undefined` when no authorized route satisfies the category.
 */
function resolveWorkspacePoolRoute(
  category: GatewayTaskCategory,
  policy: RoutingPolicy,
): AllowedModelRoute | undefined {
  switch (category) {
    case 'backend':
    case 'sql':
    case 'release':
      return findPoolRoute(policy, 'workspace', ['deepseek-v4-flash', 'deepseek-v4-flash-latest'])
    case 'frontend':
      return findPoolRoute(policy, 'workspace', ['k3', 'minimax-h3'])
    case 'reasoning':
      return findPoolRoute(policy, 'workspace', ['deepseek-v4-pro'])
    case 'simple':
      return findPoolRoute(policy, 'workspace', ['deepseek-v4-flash', 'deepseek-v4-flash-latest'])
    case 'sensitive':
    case 'test':
      return undefined
    default:
      assertNever(category)
  }
}

/**
 * Resolve a gateway route decision for one zone and category.
 *
 * - **secure**: any category → local (`LKL-GLM-5.2-FP8`) only; throws if the local
 *   route is not in the zone allowlist; never falls back to an external model.
 * - **quick-qa**: only low-cost flash-class pool models; tool requests are rejected
 *   by zone metadata, not here.
 * - **workspace**: routes by category to local (test/sensitive), pool flash
 *   (backend/sql/release/simple), pool K3/MiniMax (frontend), or pool Pro (reasoning).
 *
 * @param zone - Data-boundary zone.
 * @param category - Task category from `classifyGatewayTask`.
 * @param policy - Routing policy with zone route authorization.
 * @returns The resolved route decision.
 * @throws When a secure or sensitive/test route requires a local model absent from the allowlist,
 *   or when no authorized pool route satisfies the category.
 */
export function resolveRoute(
  zone: Zone,
  category: GatewayTaskCategory,
  policy: RoutingPolicy,
): RouteDecision {
  if (zone === 'secure') {
    const local = findLocalRoute(policy, 'secure')
    if (local === undefined) {
      throw new Error(`secure zone requires local model "${LOCAL_MODEL_ID}" in the allowlist; external fallback is forbidden`)
    }
    return {
      provider: local.provider,
      model: local.model,
      tier: 'local',
      zone: 'secure',
      category,
      requiresApproval: false,
      escalation: [local],
    }
  }

  if (zone === 'quick-qa') {
    const flash = findPoolRoute(policy, 'quick-qa', ['deepseek-v4-flash', 'deepseek-v4-flash-latest'])
    if (flash === undefined) {
      throw new Error('quick-qa zone requires a flash-class pool model in the allowlist')
    }
    return {
      provider: flash.provider,
      model: flash.model,
      tier: 'pool',
      zone: 'quick-qa',
      category,
      requiresApproval: false,
      escalation: [flash],
    }
  }

  // workspace zone
  if (category === 'test' || category === 'sensitive') {
    const local = findLocalRoute(policy, 'workspace')
    if (local === undefined) {
      throw new Error(`workspace ${category} tasks require local model "${LOCAL_MODEL_ID}" in the allowlist`)
    }
    return {
      provider: local.provider,
      model: local.model,
      tier: 'local',
      zone: 'workspace',
      category,
      requiresApproval: false,
      escalation: [local],
    }
  }

  const poolRoute = resolveWorkspacePoolRoute(category, policy)
  if (poolRoute === undefined) {
    throw new Error(`workspace ${category} routing requires an authorized pool model in the allowlist`)
  }

  const requiresApproval = category === 'release'

  return {
    provider: poolRoute.provider,
    model: poolRoute.model,
    tier: 'pool',
    zone: 'workspace',
    category,
    requiresApproval,
    escalation: [poolRoute],
  }
}
