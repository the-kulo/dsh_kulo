/** Model-call gateway strategy engine entry point. */

export { assertNever } from './assert-never.ts'
export {
  classifyGatewayTask,
} from './classify.ts'
export {
  resolveRoute,
  modelRouteKey,
} from './routing.ts'
export {
  ExpertBudgetTracker,
  nextEscalation,
} from './escalation.ts'
export type { ExpertBudgetSnapshot } from './escalation.ts'
export {
  allocatePoolBudget,
} from './budget.ts'
export {
  validateReleaseTaskSpec,
} from './release.ts'
export {
  zoneMeta,
  AllowedModelRouteSchema,
  ZonePolicySchema,
  ExpertQuotaSchema,
  EscalationPolicySchema,
  TokenBudgetPolicySchema,
  ReleaseStepSchema,
  ReleaseTaskSpecSchema,
  RoutingPolicySchema,
} from './types.ts'
export type {
  Zone,
  ModelTier,
  GatewayTaskCategory,
  AllowedModelRoute,
  ZoneMeta,
  ZonePolicy,
  RouteDecision,
  ExpertQuota,
  EscalationPolicy,
  TokenBudgetPolicy,
  TokenBudgetAllocation,
  ReleaseStep,
  ReleaseTaskSpec,
  RoutingPolicy,
} from './types.ts'
