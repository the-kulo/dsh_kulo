/** Host-owned opt-in setting for model-selectable subagent delegation. */
import type { Volatile } from '@deepseek-ai/cordis'

import { Context, Service } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { SessionSeq } from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-agent'
import {
  subagentModelSelectionPolicy,
  subagentModelSelectionProjectionDefinition,
} from './model-selection-state.ts'
import {
  AllowedModelRouteSchema,
  ModelCapabilityTagSchema,
  assertAllowedModelRoutes,
  type AllowedModelRoute,
  type ModelCapabilityTag,
} from './model-selection.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** User preference sampled during Agent creation. */
    subagentModelSelection: SubagentModelSelectionConfig
  }
}

/** Stored user preference; the shipped composition defaults it off. */
export interface SubagentModelSelectionSettings {
  /** Whether new top-level Sessions receive model selection. */
  enabled: boolean
  /** Exact child LLM routes offered to new top-level Sessions. */
  allowedModels: AllowedModelRoute[]
  /** Whether automatic model assignment by task category is active. */
  autoSelect: boolean
  /** Provider/model entries with capability tags that auto-selection resolves against. */
  modelCapabilities: ModelCapabilityTag[]
}

/** Optional deployment base for the preference. */
export interface Config {
  /** Initial enabled state inherited when the user document does not override it. */
  enabled: Volatile<boolean>
  /** Initial route list inherited when the user document does not override it. */
  allowedModels: Volatile<AllowedModelRoute[]>
  /** Initial auto-select state inherited when the user document does not override it. */
  autoSelect: Volatile<boolean>
  /** Initial capability-tagged entries inherited when the user document does not override it. */
  modelCapabilities: Volatile<ModelCapabilityTag[]>
}

/** Host settings owner that records Session authorization before the first model request. */
export class SubagentModelSelectionConfig extends Service {
  static inject = ['sessionProjections', 'sessions']

  static Config = z.object({
    enabled: z.boolean().default(false).volatile(),
    allowedModels: z.array(AllowedModelRouteSchema).default([]).volatile(),
    autoSelect: z.boolean().default(false).volatile(),
    modelCapabilities: z.array(ModelCapabilityTagSchema).default([]).volatile(),
  })

  constructor(ctx: Context, private config: Config) {
    super(ctx, 'subagentModelSelection')
  }

  protected async [Service.init](): Promise<void> {
    const ctx = this.ctx
    const policyReady = ctx.sessionProjections.register(subagentModelSelectionProjectionDefinition)
    ctx.on('agent/created', async ({ agent }) => {
      const policy = await policyReady
      ctx.fiber.assertActive()
      const target = agent.session
      if (subagentModelSelectionPolicy(policy, target) !== undefined) return
      let allowedModels: AllowedModelRoute[] | undefined
      let autoSelect = false
      let modelCapabilities: ModelCapabilityTag[] = []
      const parentId = target.header.origin === 'subagent' ? target.header.parentSession : undefined
      if (parentId !== undefined) {
        const parent = ctx.sessions.get(parentId)
        if (parent !== undefined) {
          const parentPolicy = subagentModelSelectionPolicy(policy, parent)
          if (parentPolicy !== undefined) {
            allowedModels = parentPolicy.routes.map(route => ({ ...route }))
            autoSelect = parentPolicy.autoSelect
            modelCapabilities = parentPolicy.modelCapabilities.map(capability => ({
              ...capability,
              tags: [...capability.tags],
            }))
          }
        }
      } else if (target.firstLiveSeq === 0
        // oxlint-disable-next-line typescript/no-deprecated -- Existing Session history read; migration deferred.
        && target.eventAt(SessionSeq(0))?.type !== 'session/end-seed') {
        const current = this.current()
        if (current.enabled) {
          allowedModels = current.allowedModels
          autoSelect = current.autoSelect
          modelCapabilities = current.modelCapabilities
        }
      }
      if (allowedModels !== undefined) target.append('subagent/model-selection-policy', {
        allowedModels,
        autoSelect,
        modelCapabilities,
      })
    })
    await policyReady
  }

  /**
   * Read a detached selection preference for the next fresh top-level Session.
   * @returns the enabled state and exact allowed routes.
   */
  private current(): SubagentModelSelectionSettings {
    const enabled = this.config.enabled.get()
    const autoSelect = this.config.autoSelect.get()
    const allowedModels = this.config.allowedModels.get()
    const modelCapabilities = this.config.modelCapabilities.get()
    assertAllowedModelRoutes(allowedModels)
    if (enabled && allowedModels.length === 0) {
      throw new Error('enabled subagent model selection requires at least one allowed model')
    }
    return {
      enabled,
      autoSelect,
      allowedModels: allowedModels.map(route => ({ ...route })),
      modelCapabilities: modelCapabilities.map(cap => ({ ...cap, tags: [...cap.tags] })),
    }
  }

}

export const name = 'subagent-model-selection-settings'
export default SubagentModelSelectionConfig
