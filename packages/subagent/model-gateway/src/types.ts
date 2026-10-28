/** Gateway type definitions and schemastery schemas for configuration-boundary validation. */

import z from '@deepseek-ai/schemastery'
import { assertNever } from './assert-never.ts'

/** Data-boundary zone controlling isolation, tool access, and external-model policy. */
export type Zone = 'workspace' | 'quick-qa' | 'secure'

/** Model tier governing cost pool, quota, and fallback rules. */
export type ModelTier = 'expert' | 'pool' | 'local'

/** Task category driving automatic model routing. */
export type GatewayTaskCategory =
  | 'sensitive'
  | 'test'
  | 'backend'
  | 'frontend'
  | 'sql'
  | 'release'
  | 'reasoning'
  | 'simple'

/** One authorized provider/model route. */
export interface AllowedModelRoute {
  /** Registered LLM provider id. */
  readonly provider: string
  /** Provider-owned exact model id. */
  readonly model: string
}

/** Metadata describing one zone's isolation and capability policy. */
export interface ZoneMeta {
  /** Whether tool calls are permitted in this zone. */
  readonly allowsTools: boolean
  /** Default maximum context-window token budget. */
  readonly defaultContextBudget: number
  /** Whether external (non-local) models may serve this zone. */
  readonly allowsExternalModels: boolean
}

/** Per-zone routing policy entry. */
export interface ZonePolicy {
  /** Zone this policy governs. */
  readonly zone: Zone
  /** Authorized local routes for sensitive/test enforcement. */
  readonly localRoutes: AllowedModelRoute[]
  /** Authorized pool routes available to this zone. */
  readonly poolRoutes: AllowedModelRoute[]
}

/** Resolved routing decision for one gateway request. */
export interface RouteDecision {
  /** Selected LLM provider id. */
  readonly provider: string
  /** Selected provider-owned model id. */
  readonly model: string
  /** Model tier of the selected route. */
  readonly tier: ModelTier
  /** Zone the request was resolved under. */
  readonly zone: Zone
  /** Task category that drove routing. */
  readonly category: GatewayTaskCategory
  /** Whether human approval is required before execution. */
  readonly requiresApproval: boolean
  /** Ordered escalation chain from the initial route to the final selection. */
  readonly escalation: readonly AllowedModelRoute[]
}

/** Expert-tier daily quota and escalation limits. */
export interface ExpertQuota {
  /** Maximum expert-model invocations per UTC day. */
  readonly dailyCallLimit: number
  /** Maximum escalation steps for a single task. */
  readonly maxEscalationsPerTask: number
  /** Maximum context-window token budget for one expert escalation round. */
  readonly maxContextBudgetPerRound: number
}

/** Escalation chain and expert-quota policy for one zone/category pair. */
export interface EscalationPolicy {
  /** Zone this policy applies to. */
  readonly zone: Zone
  /** Task category this policy applies to. */
  readonly category: GatewayTaskCategory
  /** Ordered route chain from pool to expert. */
  readonly chain: AllowedModelRoute[]
  /** Expert-tier quota enforced at escalation time. */
  readonly expertQuota: ExpertQuota
}

/** Pool-tier daily token budget allocation policy. */
export interface TokenBudgetPolicy {
  /** Total daily pool token budget. */
  readonly dailyPoolTotal: number
  /** Fraction allocated to routine execution (0.65–0.75). */
  readonly routineFraction: number
  /** Fraction allocated to complex review (0.10–0.20). */
  readonly reviewFraction: number
  /** Fraction reserved (0.15). */
  readonly reservedFraction: number
}

/** Allocated token amounts derived from a {@link TokenBudgetPolicy}. */
export interface TokenBudgetAllocation {
  /** Tokens allocated to routine execution. */
  readonly routine: number
  /** Tokens allocated to complex review. */
  readonly review: number
  /** Tokens reserved. */
  readonly reserved: number
  /** Total tokens, echoing the policy total. */
  readonly total: number
}

/** Structured step in a release task specification. */
export interface ReleaseStep {
  /** Step description. */
  readonly description: string
  /** Whether this step is irreversible or production-affecting. */
  readonly irreversible: boolean
}

/** Release task specification validated before execution. */
export interface ReleaseTaskSpec {
  /** Requirement description. */
  readonly description: string
  /** Structured execution steps. */
  readonly steps: ReleaseStep[]
  /** Whether human approval is required before execution. */
  readonly requiresApproval: boolean
  /** Canary rollout percentage (0–100). */
  readonly rolloutPercentage: number
  /** Rollback strategy description, required for irreversible steps. */
  readonly rollbackStrategy: string
}

/** Routing policy combining zone and escalation configuration. */
export interface RoutingPolicy {
  /** Per-zone route authorization. */
  readonly zones: ZonePolicy[]
  /** Per-zone/category escalation chains. */
  readonly escalations: EscalationPolicy[]
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

/** Schema for {@link AllowedModelRoute}. */
export const AllowedModelRouteSchema: z<AllowedModelRoute> = z.object({
  provider: z.string().min(1).required(),
  model: z.string().min(1).required(),
})

/** Schema for {@link ZonePolicy}. */
export const ZonePolicySchema: z<ZonePolicy> = z.object({
  zone: z.union([
    z.const('workspace' as const),
    z.const('quick-qa' as const),
    z.const('secure' as const),
  ]),
  localRoutes: z.array(AllowedModelRouteSchema).default([]),
  poolRoutes: z.array(AllowedModelRouteSchema).default([]),
})

/** Schema for {@link ExpertQuota}. */
export const ExpertQuotaSchema: z<ExpertQuota> = z.object({
  dailyCallLimit: z.natural().min(0),
  maxEscalationsPerTask: z.natural().min(0),
  maxContextBudgetPerRound: z.natural().min(0),
})

/** Schema for {@link EscalationPolicy}. */
export const EscalationPolicySchema: z<EscalationPolicy> = z.object({
  zone: z.union([
    z.const('workspace' as const),
    z.const('quick-qa' as const),
    z.const('secure' as const),
  ]),
  category: z.union([
    z.const('sensitive' as const),
    z.const('test' as const),
    z.const('backend' as const),
    z.const('frontend' as const),
    z.const('sql' as const),
    z.const('release' as const),
    z.const('reasoning' as const),
    z.const('simple' as const),
  ]),
  chain: z.array(AllowedModelRouteSchema).default([]),
  expertQuota: ExpertQuotaSchema,
})

/** Schema for {@link TokenBudgetPolicy}. */
export const TokenBudgetPolicySchema: z<TokenBudgetPolicy> = z.object({
  dailyPoolTotal: z.natural().min(0),
  routineFraction: z.number().min(0.65).max(0.75),
  reviewFraction: z.number().min(0.10).max(0.20),
  reservedFraction: z.number().min(0.15).max(0.15),
})

/** Schema for {@link ReleaseStep}. */
export const ReleaseStepSchema: z<ReleaseStep> = z.object({
  description: z.string().min(1),
  irreversible: z.boolean(),
})

/** Schema for {@link ReleaseTaskSpec}. */
export const ReleaseTaskSpecSchema: z<ReleaseTaskSpec> = z.object({
  description: z.string().min(1),
  steps: z.array(ReleaseStepSchema).default([]),
  requiresApproval: z.boolean(),
  rolloutPercentage: z.number().min(0).max(100),
  rollbackStrategy: z.string(),
})

/** Schema for {@link RoutingPolicy}. */
export const RoutingPolicySchema: z<RoutingPolicy> = z.object({
  zones: z.array(ZonePolicySchema).default([]),
  escalations: z.array(EscalationPolicySchema).default([]),
})

// ---------------------------------------------------------------------------
// Zone metadata
// ---------------------------------------------------------------------------

const ZONE_METAS: Record<Zone, ZoneMeta> = {
  workspace: {
    allowsTools: true,
    defaultContextBudget: 128_000,
    allowsExternalModels: true,
  },
  'quick-qa': {
    allowsTools: false,
    defaultContextBudget: 8_000,
    allowsExternalModels: true,
  },
  secure: {
    allowsTools: true,
    defaultContextBudget: 256_000,
    allowsExternalModels: false,
  },
}

/**
 * Read static metadata for one zone.
 * @param zone - The data-boundary zone.
 * @returns Zone isolation and capability metadata.
 */
export function zoneMeta(zone: Zone): ZoneMeta {
  switch (zone) {
    case 'workspace': return ZONE_METAS.workspace
    case 'quick-qa': return ZONE_METAS['quick-qa']
    case 'secure': return ZONE_METAS.secure
    default: assertNever(zone)
  }
}
