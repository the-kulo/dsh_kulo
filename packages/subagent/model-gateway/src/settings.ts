/** Host-owned model gateway routing configuration exposed to the settings panel. */

import type { Volatile } from '@deepseek-ai/cosmokit'
import { Context, Service } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { assertNever } from './assert-never.ts'
import type { GatewayTaskCategory, ModelTier, Zone } from './types.ts'

/** One editable zone × category → model routing entry. */
export interface ModelGatewayRouteEntry {
  /** Data-boundary zone this route governs. */
  readonly zone: Zone
  /** Task category that drives this routing decision. */
  readonly category: GatewayTaskCategory
  /** Registered LLM provider id. */
  readonly provider: string
  /** Provider-owned exact model id. */
  readonly model: string
  /** Model tier of this route. */
  readonly tier: ModelTier
}

/** Expert-tier daily quota and escalation limits. */
export interface ModelGatewayExpertQuota {
  /** Maximum expert-model invocations per UTC day. */
  readonly dailyCallLimit: number
  /** Maximum escalation steps for a single task. */
  readonly maxEscalationsPerTask: number
  /** Maximum context-window token budget for one expert escalation round. */
  readonly contextBudgetTokens: number
}

/** Pool-tier daily token budget allocation. */
export interface ModelGatewayTokenBudget {
  /** Total daily pool token budget. */
  readonly dailyTotal: number
  /** Fraction allocated to routine execution. */
  readonly regularShare: number
  /** Fraction allocated to complex review. */
  readonly reviewShare: number
  /** Fraction reserved for spikes. */
  readonly reserveShare: number
}

/** Stored model gateway preference document. */
export interface ModelGatewaySettings {
  /** Whether the gateway routing policy is active. */
  readonly enabled: boolean
  /** User-editable zone × category → model routing table. */
  readonly routing: readonly ModelGatewayRouteEntry[]
  /** Expert-tier quota limits. */
  readonly expertQuota: ModelGatewayExpertQuota
  /** Pool-tier token budget allocation. */
  readonly tokenBudget: ModelGatewayTokenBudget
}

/** Optional deployment base for the preference. */
export interface ModelGatewayConfigShape {
  /** Initial enabled state inherited when the user document does not override it. */
  readonly enabled: Volatile<boolean>
  /** Initial routing table inherited when the user document does not override it. */
  readonly routing: Volatile<ModelGatewayRouteEntry[]>
  /** Initial expert quota inherited when the user document does not override it. */
  readonly expertQuota: Volatile<ModelGatewayExpertQuota>
  /** Initial token budget inherited when the user document does not override it. */
  readonly tokenBudget: Volatile<ModelGatewayTokenBudget>
}

const ZoneSchema = z.union([
  z.const('workspace' as const),
  z.const('quick-qa' as const),
  z.const('secure' as const),
])

const CategorySchema = z.union([
  z.const('sensitive' as const),
  z.const('test' as const),
  z.const('backend' as const),
  z.const('frontend' as const),
  z.const('sql' as const),
  z.const('release' as const),
  z.const('reasoning' as const),
  z.const('simple' as const),
])

const TierSchema = z.union([
  z.const('expert' as const),
  z.const('pool' as const),
  z.const('local' as const),
])

/** Schema for {@link ModelGatewayRouteEntry}. */
export const ModelGatewayRouteEntrySchema: z<ModelGatewayRouteEntry> = z.object({
  zone: ZoneSchema,
  category: CategorySchema,
  provider: z.string().min(1).required(),
  model: z.string().min(1).required(),
  tier: TierSchema,
})

/** Schema for {@link ModelGatewayExpertQuota}. */
export const ModelGatewayExpertQuotaSchema: z<ModelGatewayExpertQuota> = z.object({
  dailyCallLimit: z.natural().min(0),
  maxEscalationsPerTask: z.natural().min(0),
  contextBudgetTokens: z.natural().min(0),
})

/** Schema for {@link ModelGatewayTokenBudget}. */
export const ModelGatewayTokenBudgetSchema: z<ModelGatewayTokenBudget> = z.object({
  dailyTotal: z.natural().min(0),
  regularShare: z.number().min(0).max(1),
  reviewShare: z.number().min(0).max(1),
  reserveShare: z.number().min(0).max(1),
})

const LOCAL_PROVIDER = 'local'
const LKL_MODEL = 'LKL-GLM-5.2-FP8'
const POOL_PROVIDER = 'deepseek'
const FLASH_MODEL = 'deepseek-v4-flash'
const PRO_MODEL = 'deepseek-v4-pro'
const K3_PROVIDER = 'k3'
const K3_MODEL = 'k3'

/** Default routing table mirroring the current routing.ts rules. */
export const DEFAULT_ROUTING: readonly ModelGatewayRouteEntry[] = [
  { zone: 'secure', category: 'sensitive', provider: LOCAL_PROVIDER, model: LKL_MODEL, tier: 'local' },
  { zone: 'secure', category: 'test', provider: LOCAL_PROVIDER, model: LKL_MODEL, tier: 'local' },
  { zone: 'workspace', category: 'sensitive', provider: LOCAL_PROVIDER, model: LKL_MODEL, tier: 'local' },
  { zone: 'workspace', category: 'test', provider: LOCAL_PROVIDER, model: LKL_MODEL, tier: 'local' },
  { zone: 'workspace', category: 'backend', provider: POOL_PROVIDER, model: FLASH_MODEL, tier: 'pool' },
  { zone: 'workspace', category: 'sql', provider: POOL_PROVIDER, model: FLASH_MODEL, tier: 'pool' },
  { zone: 'workspace', category: 'release', provider: POOL_PROVIDER, model: FLASH_MODEL, tier: 'pool' },
  { zone: 'workspace', category: 'simple', provider: POOL_PROVIDER, model: FLASH_MODEL, tier: 'pool' },
  { zone: 'workspace', category: 'frontend', provider: K3_PROVIDER, model: K3_MODEL, tier: 'pool' },
  { zone: 'workspace', category: 'reasoning', provider: POOL_PROVIDER, model: PRO_MODEL, tier: 'pool' },
  { zone: 'quick-qa', category: 'sensitive', provider: LOCAL_PROVIDER, model: LKL_MODEL, tier: 'local' },
  { zone: 'quick-qa', category: 'test', provider: LOCAL_PROVIDER, model: LKL_MODEL, tier: 'local' },
  { zone: 'quick-qa', category: 'backend', provider: POOL_PROVIDER, model: FLASH_MODEL, tier: 'pool' },
  { zone: 'quick-qa', category: 'frontend', provider: POOL_PROVIDER, model: FLASH_MODEL, tier: 'pool' },
  { zone: 'quick-qa', category: 'sql', provider: POOL_PROVIDER, model: FLASH_MODEL, tier: 'pool' },
  { zone: 'quick-qa', category: 'release', provider: POOL_PROVIDER, model: FLASH_MODEL, tier: 'pool' },
  { zone: 'quick-qa', category: 'reasoning', provider: POOL_PROVIDER, model: FLASH_MODEL, tier: 'pool' },
  { zone: 'quick-qa', category: 'simple', provider: POOL_PROVIDER, model: FLASH_MODEL, tier: 'pool' },
]

/** Default expert quota limits. */
export const DEFAULT_EXPERT_QUOTA: ModelGatewayExpertQuota = {
  dailyCallLimit: 20,
  maxEscalationsPerTask: 2,
  contextBudgetTokens: 200_000,
}

/** Default token budget allocation. */
export const DEFAULT_TOKEN_BUDGET: ModelGatewayTokenBudget = {
  dailyTotal: 200_000_000,
  regularShare: 0.7,
  reviewShare: 0.15,
  reserveShare: 0.15,
}

/**
 * Exhaustiveness guard for zone × category routing entries at the settings boundary.
 * @param entry - one routing table row.
 */
export function assertValidRouteEntry(entry: ModelGatewayRouteEntry): void {
  switch (entry.zone) {
    case 'workspace':
    case 'quick-qa':
    case 'secure':
      break
    default:
      assertNever(entry.zone)
  }
  switch (entry.category) {
    case 'sensitive':
    case 'test':
    case 'backend':
    case 'frontend':
    case 'sql':
    case 'release':
    case 'reasoning':
    case 'simple':
      break
    default:
      assertNever(entry.category)
  }
  switch (entry.tier) {
    case 'expert':
    case 'pool':
    case 'local':
      break
    default:
      assertNever(entry.tier)
  }
}

/** Host settings owner exposing the model gateway routing preference through configForms. */
export class ModelGatewayConfig extends Service {
  static Config = z.object({
    enabled: z.boolean().default(true).volatile(),
    routing: z.array(ModelGatewayRouteEntrySchema).default([...DEFAULT_ROUTING]).volatile(),
    expertQuota: ModelGatewayExpertQuotaSchema.default({ ...DEFAULT_EXPERT_QUOTA }).volatile(),
    tokenBudget: ModelGatewayTokenBudgetSchema.default({ ...DEFAULT_TOKEN_BUDGET }).volatile(),
  })

  constructor(ctx: Context, private readonly config: ModelGatewayConfigShape) {
    super(ctx, 'modelGatewaySettings')
  }

  /**
   * Read the current effective gateway routing preference.
   * @returns the resolved enabled state, routing table, expert quota, and token budget.
   */
  current(): ModelGatewaySettings {
    const enabled = this.config.enabled.get()
    const routing = this.config.routing.get()
    const expertQuota = this.config.expertQuota.get()
    const tokenBudget = this.config.tokenBudget.get()
    for (const entry of routing) assertValidRouteEntry(entry)
    return {
      enabled,
      routing: routing.map(entry => ({ ...entry })),
      expertQuota: { ...expertQuota },
      tokenBudget: { ...tokenBudget },
    }
  }
}

export const name = 'model-gateway-settings'
export default ModelGatewayConfig
