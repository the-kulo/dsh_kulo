/** Child LLM route selection for the subagent tool. */

import { ReasoningEffortId } from '@deepseek-ai/dsh-llm'
import type { LlmRuntime } from '@deepseek-ai/dsh-llm'
import type { AgentOptions } from '@deepseek-ai/dsh-agent'
import z from '@deepseek-ai/schemastery'

/** One exact child LLM route authorized by a user setting. */
export interface AllowedModelRoute {
  /** Registered LLM provider id. */
  readonly provider: string
  /** Provider-owned exact model id. */
  readonly model: string
}

/** Schema shared by the Host setting and its deployment base. */
export const AllowedModelRouteSchema: z<AllowedModelRoute> = z.object({
  provider: z.string().min(1).required(),
  model: z.string().min(1).required(),
})

/** Task kind that guides automatic child LLM assignment. */
export type TaskCategory = 'sensitive' | 'code' | 'reasoning' | 'simple'

/** Specialties and automatic availability for one exact child route. */
export interface ModelCapabilityTag {
  readonly provider: string
  readonly model: string
  /** Supported routing tags are `flash`, `code`, and `reasoning`. */
  readonly tags: string[]
  /** Whether automatic routing may use this route; manual selection is unaffected. */
  readonly autoSelectable: boolean
}

/** Schema for capability-tagged provider/model entries. */
export const ModelCapabilityTagSchema: z<ModelCapabilityTag> = z.object({
  provider: z.string().min(1).required(),
  model: z.string().min(1).required(),
  tags: z.array(z.string().min(1)).default([]),
  autoSelectable: z.boolean().default(true),
})

/** Exact routes and automatic-routing metadata authorized for one Session. */
export interface ModelSelectionPolicy {
  /** Exact provider/model routes authorized for explicit and automatic selection. */
  readonly routes: readonly AllowedModelRoute[]
  /** Whether automatic model assignment by task category is active. */
  readonly autoSelect: boolean
  /** Provider/model entries with capability tags that auto-selection resolves against. */
  readonly modelCapabilities: readonly ModelCapabilityTag[]
}

/**
 * Stable identity for one provider/model pair.
 * @param route - Exact provider/model route.
 * @returns Opaque key for equality checks.
 */
export function modelRouteKey(route: AllowedModelRoute): string {
  return `${route.provider}\0${route.model}`
}

/**
 * Reject malformed or duplicate route policy entries at a durable or configuration boundary.
 * @param routes - Candidate exact routes to validate.
 * @returns an assertion that the candidate is a validated exact-route array.
 */
export function assertAllowedModelRoutes(routes: unknown): asserts routes is readonly AllowedModelRoute[] {
  if (!Array.isArray(routes)) {
    throw new Error('subagent model selection requires an array of routes')
  }
  const seen = new Set<string>()
  const candidates: readonly unknown[] = routes
  for (const candidate of candidates) {
    if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate)
      || !('provider' in candidate) || typeof candidate.provider !== 'string'
      || !('model' in candidate) || typeof candidate.model !== 'string'
      || candidate.provider.length === 0 || candidate.model.length === 0) {
      throw new Error('subagent model selection requires non-empty provider and model ids')
    }
    const route = { provider: candidate.provider, model: candidate.model }
    const key = modelRouteKey(route)
    if (seen.has(key)) {
      throw new Error(`subagent model selection repeats route "${route.provider}/${route.model}"`)
    }
    seen.add(key)
  }
}

/**
 * Reject malformed or duplicate automatic-routing metadata at a durable or configuration boundary.
 * @param capabilities - Candidate specialty and availability entries to validate.
 * @returns an assertion that the candidate is a validated capability array.
 */
export function assertModelCapabilities(capabilities: unknown): asserts capabilities is readonly ModelCapabilityTag[] {
  if (!Array.isArray(capabilities)) {
    throw new Error('subagent model selection requires an array of model capabilities')
  }
  const seen = new Set<string>()
  const candidates: readonly unknown[] = capabilities
  for (const candidate of candidates) {
    const routes = [candidate]
    assertAllowedModelRoutes(routes)
    const [route] = routes
    if (!route) throw new Error('assertAllowedModelRoutes did not enforce non-empty routes')
    if (typeof candidate !== 'object' || candidate === null || !('tags' in candidate)
      || !Array.isArray(candidate.tags)
      || !candidate.tags.every(tag => typeof tag === 'string' && tag.length > 0)
      || !('autoSelectable' in candidate) || typeof candidate.autoSelectable !== 'boolean') {
      throw new Error('subagent model capabilities require non-empty tags and a boolean autoSelectable field')
    }
    const key = modelRouteKey(route)
    if (seen.has(key)) {
      throw new Error(`subagent model selection repeats capabilities for "${route.provider}/${route.model}"`)
    }
    seen.add(key)
  }
}

/** Model-facing child LLM route fields. */
export interface DelegationModelRequest {
  readonly provider?: string
  readonly model?: string
  readonly reasoning_effort?: string
}

/**
 * Whether a call explicitly selects any child LLM value.
 * @param request - Model-facing route fields from the tool call.
 * @returns Whether at least one route or effort field is present.
 */
export function hasDelegationModelRequest(request: DelegationModelRequest): boolean {
  return request.provider !== undefined
    || request.model !== undefined
    || request.reasoning_effort !== undefined
}

/** Reject an empty model-facing route value at the tool JSON boundary. */
function assertNonEmpty(value: string | undefined, field: keyof DelegationModelRequest): void {
  if (value !== undefined && value.length === 0) {
    throw new Error(`child LLM \`${field}\` must be non-empty`)
  }
}

/**
 * Merge model-supplied selection fields over configured child defaults.
 * Provider and model form one route and must be supplied together. Changing
 * that route without an effort clears the configured route-owned effort.
 * @param parentOptions - Current parent values that supply missing child values.
 * @param configured - Tool-instance child defaults.
 * @param request - Model-facing route override.
 * @param enabled - Whether this tool instance permits model-facing selection.
 * @returns Child Agent options, preserving omission when no layer contributes one.
 */
export function requestedAgentOptions(
  parentOptions: AgentOptions,
  configured: AgentOptions | undefined,
  request: DelegationModelRequest,
  enabled: boolean,
): AgentOptions | undefined {
  if (!hasDelegationModelRequest(request)) return configured
  if (!enabled) {
    throw new Error('child model selection is disabled for this tool instance')
  }
  assertNonEmpty(request.provider, 'provider')
  assertNonEmpty(request.model, 'model')
  assertNonEmpty(request.reasoning_effort, 'reasoning_effort')
  if ((request.provider === undefined) !== (request.model === undefined)) {
    throw new Error('child LLM `provider` and `model` must be supplied together')
  }

  const baselineProvider = configured?.provider ?? parentOptions.provider
  const baselineModel = configured?.model ?? parentOptions.model
  const routeChanged = request.provider !== undefined
    && (request.provider !== baselineProvider || request.model !== baselineModel)
  const { reasoningEffort: _configuredReasoningEffort, ...configuredWithoutReasoning } = configured ?? {}
  return {
    ...routeChanged && request.reasoning_effort === undefined ? configuredWithoutReasoning : configured,
    ...request.provider === undefined ? {} : { provider: request.provider, model: request.model },
    ...request.reasoning_effort === undefined
      ? {}
      : { reasoningEffort: ReasoningEffortId(request.reasoning_effort) },
  }
}

/**
 * Enforce a settings-owned route list at the operation that creates the child.
 * Pure inheritance remains outside this policy because no model-facing choice
 * occurred; any explicit route or effort field must resolve to an allowed route.
 * @param policy - Session allowlist; omission permits only the current parent route.
 * @param parentOptions - Current parent values that supply missing child values.
 * @param requested - Effective child options after request/config merging.
 * @param request - Model-facing selection fields from the tool call.
 */
export function assertAllowedModelSelection(
  policy: ModelSelectionPolicy | undefined,
  parentOptions: AgentOptions,
  requested: AgentOptions | undefined,
  request: DelegationModelRequest,
): void {
  if (!hasDelegationModelRequest(request)) return
  const provider = requested?.provider ?? parentOptions.provider
  const model = requested?.model ?? parentOptions.model
  if (provider === undefined || model === undefined) {
    throw new Error('cannot select child LLM values without an effective provider and model')
  }
  const allowed = policy === undefined
    ? provider === parentOptions.provider && model === parentOptions.model
    : policy.routes.some(route => route.provider === provider && route.model === model)
  if (allowed) return
  throw new Error(`child LLM route "${provider}/${model}" is not allowed for this Session`
    + (policy === undefined
      ? '; without a recorded model-selection policy, explicit selection (including reasoning_effort) is limited to the parent route'
      : ''))
}

/**
 * Whether configured Agent options require route validation before delegation.
 * @param options - Tool-instance child defaults.
 * @returns Whether configured provider, model, or effort values must be resolved.
 */
export function hasConfiguredLlmSelection(options: AgentOptions | undefined): boolean {
  return options?.provider !== undefined
    || options?.model !== undefined
    || options?.reasoningEffort !== undefined
}

/**
 * Resolve an effective child route through its live adapter before the child is
 * created. The LLM runtime owns provider lookup, exact-model metadata, effort
 * validation, and adapter defaults.
 * @param llm - Live LLM runtime.
 * @param parentOptions - Current parent values whose compatible fields the child inherits.
 * @param requested - Per-child options after request/config merging.
 * @param signal - Tool-call cancellation signal.
 * @param inheritParentReasoningEffort - Whether an omitted effort may inherit from the parent route.
 */
export async function preflightChildLlmRoute(
  llm: LlmRuntime,
  parentOptions: AgentOptions,
  requested: AgentOptions | undefined,
  signal: AbortSignal,
  inheritParentReasoningEffort = true,
): Promise<void> {
  const provider = requested?.provider ?? parentOptions.provider
  const model = requested?.model ?? parentOptions.model
  if (provider === undefined || model === undefined) {
    throw new Error('cannot select child LLM values without an effective provider and model')
  }
  const routeChanged = provider !== parentOptions.provider || model !== parentOptions.model
  const reasoningEffort = requested?.reasoningEffort
    ?? (inheritParentReasoningEffort && !routeChanged ? parentOptions.reasoningEffort : undefined)
  await llm.resolveCallConfig({
    provider,
    model,
    ...reasoningEffort === undefined ? {} : { reasoningEffort },
  }, signal)
}

const SENSITIVE_MODEL = 'LKL-GLM-5.2-FP8'
const UNAVAILABLE_AUTO_MODEL = 'TC-gpt-5.3-codex'
const SENSITIVE_PATTERN = new RegExp(
  '\\b(?:sensitive|secrets?|credentials?|api[- ]?keys?|tokens?|passwords?|authentication|authorization)\\b'
  + '|敏感|密钥|凭据|密码|令牌|认证|鉴权', 'iu')
const CODE_PATTERN = new RegExp(
  '\\b(?:code|coding|implement(?:ation)?|fix|debug|refactor|build|program|tests?|typescript|javascript|python|rust)\\b'
  + '|代码|编程|实现|修复|调试|重构|构建|测试', 'iu')
const REASONING_PATTERN = new RegExp(
  '\\b(?:analy[sz]e|analysis|reasoning|research|investigate|review|plan|design|evaluate|complex|architecture)\\b'
  + '|分析|推理|研究|调查|审查|评审|规划|设计|评估|复杂|架构', 'iu')

/**
 * Assign a task category from the subagent description and prompt.
 * Sensitive keywords take precedence over code, which takes precedence over reasoning.
 * @param description - Short task label supplied to the delegation tool.
 * @param prompt - Complete delegated task.
 * @returns The task category used for automatic routing.
 */
export function classifyTask(description: string, prompt: string): TaskCategory {
  const text = `${description} ${prompt}`
  if (SENSITIVE_PATTERN.test(text)) return 'sensitive'
  if (CODE_PATTERN.test(text)) return 'code'
  if (REASONING_PATTERN.test(text)) return 'reasoning'
  return 'simple'
}

/**
 * Select an allowed, auto-selectable route by task category in provider/model id order.
 * Sensitive tasks accept only `LKL-GLM-5.2-FP8`. Other categories require their
 * matching `flash`, `code`, or `reasoning` tag and never fall back to another specialty.
 * `TC-gpt-5.3-codex` is excluded from automatic routing while its endpoint returns 400.
 * @param category - Task category from {@link classifyTask}.
 * @param routes - Session-authorized routes.
 * @param capabilities - Configured specialty and availability metadata.
 * @returns The selected exact route.
 * @throws When no authorized route satisfies the category.
 */
export function selectModelForTask(
  category: TaskCategory,
  routes: readonly AllowedModelRoute[],
  capabilities: readonly ModelCapabilityTag[],
): AllowedModelRoute {
  const allowed = new Set(routes.map(modelRouteKey))
  const candidates = capabilities
    .filter(capability => capability.autoSelectable
      && capability.model !== UNAVAILABLE_AUTO_MODEL
      && allowed.has(modelRouteKey(capability)))
    .sort((left, right) => left.provider === right.provider
      ? left.model < right.model ? -1 : left.model > right.model ? 1 : 0
      : left.provider < right.provider ? -1 : 1)

  if (category === 'sensitive') {
    const sensitive = candidates.find(capability => capability.model === SENSITIVE_MODEL)
    if (sensitive === undefined) {
      throw new Error(`sensitive subagent tasks require "${SENSITIVE_MODEL}" in the Session allowlist with auto-selection enabled`)
    }
    return { provider: sensitive.provider, model: sensitive.model }
  }

  const tag = category === 'simple' ? 'flash' : category
  const selected = candidates.find(capability => capability.tags.some(candidate => candidate.toLowerCase() === tag))
  if (selected === undefined) {
    throw new Error(`automatic ${category} subagent routing requires an allowed auto-selectable model tagged "${tag}"`)
  }
  return { provider: selected.provider, model: selected.model }
}
