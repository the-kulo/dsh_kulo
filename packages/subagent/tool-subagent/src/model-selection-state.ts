/** Durable per-session state for the user-controlled model-selection opt-in. */

import { z as zod } from 'zod'
import type { Session } from '@deepseek-ai/dsh-session'
import type { ProjectionHandle } from '@deepseek-ai/dsh-session-projection'
import type { ProjectionDefinition } from '@deepseek-ai/dsh-session-projection'
import {
  assertAllowedModelRoutes,
  type AllowedModelRoute,
  type ModelCapabilityTag,
  type ModelSelectionPolicy,
  type TaskCategory,
} from './model-selection.ts'

declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    /**
     * Records this Session's authorized child provider/model routes. Appended
     * before the first model request; absence restricts explicit selection
     * to the current parent route. Log-only: it carries
     * no `surfaceOp` and never enters model history.
     * @param data - Exact routes and automatic-routing metadata.
     */
    'subagent/model-selection-policy': {
      /** Exact routes this Session may select explicitly for a child. */
      allowedModels: AllowedModelRoute[]
      /** Whether automatic assignment is active; legacy events default to false. */
      autoSelect?: boolean
      /** Specialty and automatic-availability metadata; legacy events default to an empty list. */
      modelCapabilities?: ModelCapabilityTag[]
    }
    /**
     * Records an automatic model selection before child creation. Log-only:
     * it carries no `surfaceOp` and never enters model history.
     * @param data - Task category and selected exact route.
     */
    'subagent/model-auto-selection': {
      /** Task category that determined the route. */
      taskCategory: TaskCategory
      /** Selected provider id. */
      selectedProvider: string
      /** Selected model id within the provider. */
      selectedModel: string
    }
  }
}

const modelSelectionPolicySchema: zod.ZodType<ModelSelectionPolicy | null> = zod.object({
  routes: zod.array(zod.object({
    provider: zod.string().min(1),
    model: zod.string().min(1),
  }).strict()).min(1),
  autoSelect: zod.boolean(),
  modelCapabilities: zod.array(zod.object({
    provider: zod.string().min(1),
    model: zod.string().min(1),
    tags: zod.array(zod.string().min(1)),
    autoSelectable: zod.boolean(),
  })),
}).nullable()

/**
 * Host-only projection of the durable model-selection policy.
 * Each independently mounted consumer registers this shared definition; the registry reference-counts it.
 */
export const subagentModelSelectionProjectionDefinition = {
  key: 'subagentModelSelectionPolicy',
  stateVersion: 2,
  stateSchema: modelSelectionPolicySchema,
  init: () => null,
  apply: (policy, event) => {
    if (policy !== null || event.type !== 'subagent/model-selection-policy') return policy
    const { allowedModels, autoSelect = false, modelCapabilities = [] } = event.data
    assertAllowedModelRoutes(allowedModels)
    if (allowedModels.length === 0) {
      throw new Error('subagent/model-selection-policy requires at least one route')
    }
    return { routes: allowedModels, autoSelect, modelCapabilities }
  },
} satisfies ProjectionDefinition<'subagentModelSelectionPolicy', ModelSelectionPolicy | null>

/**
 * Read the model-selection policy authorized for a Session.
 * @param subagentModelSelectionProjectionHandle - registered policy state reader.
 * @param session - session whose durable decision is read.
 * @returns a detached policy, or undefined to restrict selection to the parent route.
 */
export function subagentModelSelectionPolicy(
  subagentModelSelectionProjectionHandle: Pick<ProjectionHandle<ModelSelectionPolicy | null>, 'stateOf'>,
  session: Session,
): ModelSelectionPolicy | undefined {
  const policy = subagentModelSelectionProjectionHandle.stateOf(session)
  if (policy === null) return undefined
  return {
    routes: policy.routes.map(route => ({ ...route })),
    autoSelect: policy.autoSelect,
    modelCapabilities: policy.modelCapabilities.map(cap => ({
      ...cap,
      tags: [...cap.tags],
    })),
  }
}
