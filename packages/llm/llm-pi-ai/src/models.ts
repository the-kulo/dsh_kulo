/** pi-ai model helpers assembled from public narrow entry points. */

import { builtinModels } from '@earendil-works/pi-ai/providers/all'
import type {
  Api,
  CreateModelsOptions,
  Model,
  ModelThinkingLevel,
  MutableModels,
  Provider,
  ProviderAuth,
  ProviderStreams,
} from '@earendil-works/pi-ai'
import type { LlmResolvedModelInfo } from '@deepseek-ai/dsh-llm'
import { THINKING_LEVELS } from './catalog.ts'

/** Input accepted by the static, single-protocol providers this package builds. */
interface StaticProviderOptions {
  id: string
  name: string
  baseUrl?: string
  auth: ProviderAuth
  models: readonly Model<Api>[]
  api: ProviderStreams
}

/**
 * Create an empty pi-ai collection without importing its aggregate entry point.
 * @param options - credential storage and ambient authentication integrations.
 * @returns a mutable collection with no registered providers.
 */
export function createModels(options?: CreateModelsOptions): MutableModels {
  const models = builtinModels(options)
  models.clearProviders()
  return models
}

/**
 * Create the static, single-protocol provider used by configured custom routes.
 * @param input - provider identity, models, authentication, and protocol implementation.
 * @returns a provider that delegates each operation to the supplied protocol.
 */
export function createProvider(input: StaticProviderOptions): Provider {
  return {
    id: input.id,
    name: input.name,
    ...input.baseUrl === undefined ? {} : { baseUrl: input.baseUrl },
    auth: input.auth,
    getModels: () => input.models,
    stream: (model, context, options) => input.api.stream(model, context, options),
    streamSimple: (model, context, options) => input.api.streamSimple(model, context, options),
  }
}

/**
 * Wrap one provider so its chat-model listing also carries runtime-discovered
 * models, while every request dispatch still delegates to the base provider.
 * The discovered models share the base provider's identity, endpoint, and
 * protocol implementations, so a listing-added model stays requestable.
 * @param base - the provider whose static catalog stays the baseline.
 * @param discovered - additive models to append after the baseline.
 * @returns a provider whose `getModels()` returns the baseline plus the overlay.
 */
export function withDiscoveredModels(base: Provider, discovered: readonly Model<Api>[]): Provider {
  return {
    id: base.id,
    name: base.name,
    ...base.baseUrl === undefined ? {} : { baseUrl: base.baseUrl },
    auth: base.auth,
    getModels: () => [...base.getModels(), ...discovered],
    ...base.getAllModels === undefined ? {} : { getAllModels: base.getAllModels },
    stream: (model, context, options) => base.stream(model, context, options),
    streamSimple: (model, context, options) => base.streamSimple(model, context, options),
    ...base.fetchDeferred === undefined ? {} : { fetchDeferred: base.fetchDeferred },
    ...base.cancelDeferred === undefined ? {} : { cancelDeferred: base.cancelDeferred },
    ...base.generateImages === undefined ? {} : { generateImages: base.generateImages },
    ...base.classify === undefined ? {} : { classify: base.classify },
    ...base.refreshModels === undefined ? {} : { refreshModels: base.refreshModels },
    ...base.filterModels === undefined ? {} : { filterModels: base.filterModels },
    ...base.filterAllModels === undefined ? {} : { filterAllModels: base.filterAllModels },
  }
}

/**
 * Resolve selectable reasoning levels from pi-ai's public model metadata.
 * @param model - model descriptor carrying reasoning support and wire mappings.
 * @returns supported levels in pi-ai's escalation order.
 */
export function getSupportedThinkingLevels(model: Model<Api>): ModelThinkingLevel[] {
  if (!model.reasoning) return ['off']
  return THINKING_LEVELS.filter((level) => {
    const mapped = model.thinkingLevelMap?.[level]
    if (mapped === null) return false
    if (level === 'xhigh' || level === 'max') return mapped !== undefined
    return true
  })
}

/**
 * Resolve transcript update modes from the exact model's protocol capabilities.
 * @param model - Materialized pi-ai model, including catalog compatibility flags.
 * @returns Update modes consumed by prompt admission and tool-history projection.
 */
export function conversationUpdates(model: Model<Api>): Pick<LlmResolvedModelInfo, 'systemPromptUpdate' | 'toolUpdate'> {
  const compat = model.compat
  if (compat === undefined || !('supportsMidConvoSystemMessages' in compat)
    || !compat.supportsMidConvoSystemMessages) return {}
  const updates: Pick<LlmResolvedModelInfo, 'systemPromptUpdate' | 'toolUpdate'> = { systemPromptUpdate: 'in-history' }
  if (model.api === 'anthropic-messages'
    && 'supportsMidConvoToolChanges' in compat && compat.supportsMidConvoToolChanges) {
    updates.toolUpdate = 'in-history'
  } else if (model.api === 'openai-completions'
    && 'supportsMidConvoToolAdditions' in compat && compat.supportsMidConvoToolAdditions) {
    updates.toolUpdate = 'addition-only'
  } else if ((model.api === 'openai-responses' || model.api === 'azure-openai-responses' || model.api === 'openai-codex-responses')
    && (('supportsAdditionalTools' in compat && compat.supportsAdditionalTools)
      || ('supportsToolSearch' in compat && compat.supportsToolSearch))) {
    updates.toolUpdate = 'addition-only'
  }
  return updates
}
