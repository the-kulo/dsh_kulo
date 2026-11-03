/** Staged editor for the Host-owned model gateway routing configuration. */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { SettingsFormScope, SettingsFormShell } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ModelGatewayLocaleKey } from './locales.ts'

/** Namespace of the Host-owned model gateway settings. */
export const MODEL_GATEWAY_NS = 'model-gateway-settings'

/** Zone values the routing table accepts. */
export type GatewayZone = 'workspace' | 'quick-qa' | 'secure'

/** Category values the routing table accepts. */
export type GatewayCategory = 'sensitive' | 'test' | 'backend' | 'frontend' | 'sql' | 'release' | 'reasoning' | 'simple'

/** Tier values the routing table accepts. */
export type GatewayTier = 'expert' | 'pool' | 'local'

/** One editable zone × category → model routing entry. */
export interface GatewayRouteEntry {
  /** Data-boundary zone this route governs. */
  zone: GatewayZone
  /** Task category that drives this routing decision. */
  category: GatewayCategory
  /** Registered LLM provider id. */
  provider: string
  /** Provider-owned exact model id. */
  model: string
  /** Model tier of this route. */
  tier: GatewayTier
}

/** Expert-tier daily quota and escalation limits. */
export interface GatewayExpertQuota {
  /** Maximum expert-model invocations per UTC day. */
  dailyCallLimit: number
  /** Maximum escalation steps for a single task. */
  maxEscalationsPerTask: number
  /** Maximum context-window token budget for one expert escalation round. */
  contextBudgetTokens: number
}

/** Pool-tier daily token budget allocation. */
export interface GatewayTokenBudget {
  /** Total daily pool token budget. */
  dailyTotal: number
  /** Fraction allocated to routine execution. */
  regularShare: number
  /** Fraction allocated to complex review. */
  reviewShare: number
  /** Fraction reserved for spikes. */
  reserveShare: number
}

/** Settings document stored for the model gateway. */
export interface ModelGatewaySettingsValue {
  /** Whether the gateway routing policy is active. */
  enabled: boolean
  /** User-editable zone × category → model routing table. */
  routing: GatewayRouteEntry[]
  /** Expert-tier quota limits. */
  expertQuota: GatewayExpertQuota
  /** Pool-tier token budget allocation. */
  tokenBudget: GatewayTokenBudget
}

/** State rendered by the staged gateway card. */
export interface ModelGatewayCardState extends SettingsFormShell {
  /** Whether the draft enables gateway routing. */
  enabled: boolean
  /** Live routing table rows. */
  routing: readonly GatewayRouteEntry[]
  /** Live expert quota. */
  expertQuota: GatewayExpertQuota
  /** Live token budget. */
  tokenBudget: GatewayTokenBudget
  /** Whether a newer Host revision invalidated the current draft. */
  conflicted: boolean
  /** Whether the token budget shares do not sum to 1. */
  sharesInvalid: boolean
  /** Live provider ids for the routing provider/model candidate lists. */
  catalogProviders: readonly string[]
  /** Live model ids by provider for the routing candidate lists. */
  catalogModels: ReadonlyMap<string, readonly string[]>
}

/** Registration-side face for the model gateway card. */
export interface ModelGatewayCardFace {
  hooks: {
    /** Card snapshot bound by the renderer as useModelGatewayCard. */
    modelGatewayCard: SnapshotStore<ModelGatewayCardState>
  }
  /** Stage the enabled state. */
  toggleEnabled: () => void
  /** Stage the provider field for one routing row. */
  setRouteProvider: (index: number, provider: string) => void
  /** Stage the model field for one routing row. */
  setRouteModel: (index: number, model: string) => void
  /** Stage the zone for one routing row. */
  setRouteZone: (index: number, zone: GatewayZone) => void
  /** Stage the category for one routing row. */
  setRouteCategory: (index: number, category: GatewayCategory) => void
  /** Stage the tier for one routing row. */
  setRouteTier: (index: number, tier: GatewayTier) => void
  /** Append a new default routing row. */
  addRoute: () => void
  /** Remove one routing row. */
  removeRoute: (index: number) => void
  /** Stage one expert quota field. */
  setExpertQuota: (field: keyof GatewayExpertQuota, value: number) => void
  /** Stage one token budget field. */
  setTokenBudget: (field: keyof GatewayTokenBudget, value: number) => void
  /** Persist all staged fields as one revision-fenced mutation. */
  save: () => void
  /** Drop every staged field. */
  discard: () => void
}

/** Zone options for the dropdown. */
export const ZONE_OPTIONS: readonly { value: GatewayZone, key: ModelGatewayLocaleKey }[] = [
  { value: 'workspace', key: 'zoneWorkspace' },
  { value: 'quick-qa', key: 'zoneQuickQa' },
  { value: 'secure', key: 'zoneSecure' },
]

/** Category options for the dropdown. */
export const CATEGORY_OPTIONS: readonly { value: GatewayCategory, key: ModelGatewayLocaleKey }[] = [
  { value: 'sensitive', key: 'categorySensitive' },
  { value: 'test', key: 'categoryTest' },
  { value: 'backend', key: 'categoryBackend' },
  { value: 'frontend', key: 'categoryFrontend' },
  { value: 'sql', key: 'categorySql' },
  { value: 'release', key: 'categoryRelease' },
  { value: 'reasoning', key: 'categoryReasoning' },
  { value: 'simple', key: 'categorySimple' },
]

/** Tier options for the dropdown. */
export const TIER_OPTIONS: readonly { value: GatewayTier, key: ModelGatewayLocaleKey }[] = [
  { value: 'expert', key: 'tierExpert' },
  { value: 'pool', key: 'tierPool' },
  { value: 'local', key: 'tierLocal' },
]

const DEFAULT_ROUTE: GatewayRouteEntry = {
  zone: 'workspace',
  category: 'simple',
  provider: 'deepseek',
  model: 'deepseek-v4-flash',
  tier: 'pool',
}

function shallowEqualRouting(left: readonly GatewayRouteEntry[], right: readonly GatewayRouteEntry[]): boolean {
  if (left.length !== right.length) return false
  for (let i = 0; i < left.length; i++) {
    const l = left[i]!
    const r = right[i]!
    if (l.zone !== r.zone || l.category !== r.category || l.provider !== r.provider || l.model !== r.model || l.tier !== r.tier) return false
  }
  return true
}

function shallowEqualQuota(left: GatewayExpertQuota, right: GatewayExpertQuota): boolean {
  return left.dailyCallLimit === right.dailyCallLimit
    && left.maxEscalationsPerTask === right.maxEscalationsPerTask
    && left.contextBudgetTokens === right.contextBudgetTokens
}

function shallowEqualBudget(left: GatewayTokenBudget, right: GatewayTokenBudget): boolean {
  return left.dailyTotal === right.dailyTotal
    && left.regularShare === right.regularShare
    && left.reviewShare === right.reviewShare
    && left.reserveShare === right.reserveShare
}

function sharesSumTo1(budget: GatewayTokenBudget): boolean {
  const sum = budget.regularShare + budget.reviewShare + budget.reserveShare
  return Math.abs(sum - 1) < 1e-9
}

/** Bridges the model gateway configuration form onto a staged card. */
export class ModelGatewayCardController {
  private draftEnabled: boolean | undefined
  private draftRouting: GatewayRouteEntry[] | undefined
  private draftExpertQuota: GatewayExpertQuota | undefined
  private draftTokenBudget: GatewayTokenBudget | undefined
  private draftRevision: number | undefined
  private saving = false
  private failed = false
  private conflicted = false
  private disposed = false
  private saveGeneration = 0
  private readonly store: SnapshotStore<ModelGatewayCardState>
  private readonly unsubscribe: () => void
  private catalogProviders: readonly string[] = []
  private catalogModels = new Map<string, readonly string[]>()
  private catalogGeneration = 0
  private catalogStatus: 'idle' | 'loading' | 'ready' | 'error' = 'idle'

  /**
   * @param scope - bound `model-gateway-settings` configuration form.
   * @param ctx - the card plugin's context, whose `remote.session` serves the live model catalog.
   */
  constructor(
    private readonly scope: SettingsFormScope<ModelGatewaySettingsValue>,
    private readonly ctx: ClientContext,
  ) {
    this.store = createSnapshotStore(this.projection())
    this.unsubscribe = scope.subscribe(() => {
      if (!this.saving && this.draftRouting !== undefined
        && this.scope.getSnapshot().revision !== this.draftRevision) {
        if (this.currentEnabled() === this.enabled()
          && shallowEqualRouting(this.currentRouting(), this.desiredRouting())
          && shallowEqualQuota(this.currentExpertQuota(), this.desiredExpertQuota())
          && shallowEqualBudget(this.currentTokenBudget(), this.desiredTokenBudget())) this.clearDraft()
        else this.conflicted = true
      }
      this.publish()
    })
    void this.loadCatalog()
  }

  /** Stop observing settings and suppress late write settlements. */
  dispose(): void {
    this.disposed = true
    this.saveGeneration += 1
    this.catalogGeneration += 1
    this.unsubscribe()
  }

  /** Invalidate and reload model candidates after a Host model input changes. */
  refreshCatalog(): void {
    if (this.disposed) return
    this.catalogGeneration += 1
    this.catalogStatus = 'idle'
    void this.loadCatalog()
  }

  private async loadCatalog(): Promise<void> {
    if (this.disposed || this.catalogStatus === 'loading') return
    const generation = this.catalogGeneration
    this.catalogStatus = 'loading'
    this.publish()
    const response = await this.ctx.remote.session.modelCatalog()
    if (generation !== this.catalogGeneration) return
    if (response.ok) {
      this.catalogProviders = response.value.groups.map(group => group.id)
      this.catalogModels = new Map(
        response.value.groups.map(group => [group.id, group.models.map(model => model.id)]),
      )
      this.catalogStatus = 'ready'
    } else {
      this.catalogStatus = 'error'
    }
    this.publish()
  }

  /**
   * Build the renderer face for this card.
   * @returns the snapshot and staged card actions injected into the renderer.
   */
  inject(): ModelGatewayCardFace {
    return {
      hooks: { modelGatewayCard: this.store },
      toggleEnabled: () => { this.toggleEnabled() },
      setRouteProvider: (index, provider) => { this.setRouteProvider(index, provider) },
      setRouteModel: (index, model) => { this.setRouteModel(index, model) },
      setRouteZone: (index, zone) => { this.setRouteZone(index, zone) },
      setRouteCategory: (index, category) => { this.setRouteCategory(index, category) },
      setRouteTier: (index, tier) => { this.setRouteTier(index, tier) },
      addRoute: () => { this.addRoute() },
      removeRoute: (index) => { this.removeRoute(index) },
      setExpertQuota: (field, value) => { this.setExpertQuota(field, value) },
      setTokenBudget: (field, value) => { this.setTokenBudget(field, value) },
      save: () => { void this.save() },
      discard: () => { this.discard() },
    }
  }

  private currentEnabled(): boolean {
    return this.scope.getSnapshot().value?.enabled ?? true
  }

  private currentRouting(): GatewayRouteEntry[] {
    return this.scope.getSnapshot().value?.routing.map(route => ({ ...route })) ?? []
  }

  private currentExpertQuota(): GatewayExpertQuota {
    const value = this.scope.getSnapshot().value?.expertQuota
    return value !== undefined ? { ...value } : { dailyCallLimit: 20, maxEscalationsPerTask: 2, contextBudgetTokens: 200_000 }
  }

  private currentTokenBudget(): GatewayTokenBudget {
    const value = this.scope.getSnapshot().value?.tokenBudget
    return value !== undefined ? { ...value } : { dailyTotal: 200_000_000, regularShare: 0.7, reviewShare: 0.15, reserveShare: 0.15 }
  }

  private enabled(): boolean {
    return this.draftEnabled ?? this.currentEnabled()
  }

  private desiredRouting(): GatewayRouteEntry[] {
    return this.draftRouting ?? this.currentRouting()
  }

  private desiredExpertQuota(): GatewayExpertQuota {
    return this.draftExpertQuota ?? this.currentExpertQuota()
  }

  private desiredTokenBudget(): GatewayTokenBudget {
    return this.draftTokenBudget ?? this.currentTokenBudget()
  }

  private beginDraft(): void {
    if (this.draftRouting === undefined) {
      const snapshot = this.scope.getSnapshot()
      this.draftEnabled = snapshot.value?.enabled ?? true
      this.draftRouting = snapshot.value?.routing.map(route => ({ ...route })) ?? []
      this.draftExpertQuota = snapshot.value !== undefined ? { ...snapshot.value.expertQuota } : this.currentExpertQuota()
      this.draftTokenBudget = snapshot.value !== undefined ? { ...snapshot.value.tokenBudget } : this.currentTokenBudget()
      this.draftRevision = snapshot.revision
    }
  }

  private toggleEnabled(): void {
    const snapshot = this.scope.getSnapshot()
    if (this.disposed || snapshot.status !== 'ready' || !snapshot.writable || this.saving) return
    this.beginDraft()
    this.draftEnabled = !this.draftEnabled
    this.failed = false
    this.publish()
  }

  private setRouteProvider(index: number, provider: string): void {
    const snapshot = this.scope.getSnapshot()
    if (this.disposed || snapshot.status !== 'ready' || !snapshot.writable || this.saving) return
    this.beginDraft()
    const routing = this.draftRouting!
    if (index < 0 || index >= routing.length) return
    routing[index] = { ...routing[index]!, provider }
    this.failed = false
    this.publish()
  }

  private setRouteModel(index: number, model: string): void {
    const snapshot = this.scope.getSnapshot()
    if (this.disposed || snapshot.status !== 'ready' || !snapshot.writable || this.saving) return
    this.beginDraft()
    const routing = this.draftRouting!
    if (index < 0 || index >= routing.length) return
    routing[index] = { ...routing[index]!, model }
    this.failed = false
    this.publish()
  }

  private setRouteZone(index: number, zone: GatewayZone): void {
    const snapshot = this.scope.getSnapshot()
    if (this.disposed || snapshot.status !== 'ready' || !snapshot.writable || this.saving) return
    this.beginDraft()
    const routing = this.draftRouting!
    if (index < 0 || index >= routing.length) return
    routing[index] = { ...routing[index]!, zone }
    this.failed = false
    this.publish()
  }

  private setRouteCategory(index: number, category: GatewayCategory): void {
    const snapshot = this.scope.getSnapshot()
    if (this.disposed || snapshot.status !== 'ready' || !snapshot.writable || this.saving) return
    this.beginDraft()
    const routing = this.draftRouting!
    if (index < 0 || index >= routing.length) return
    routing[index] = { ...routing[index]!, category }
    this.failed = false
    this.publish()
  }

  private setRouteTier(index: number, tier: GatewayTier): void {
    const snapshot = this.scope.getSnapshot()
    if (this.disposed || snapshot.status !== 'ready' || !snapshot.writable || this.saving) return
    this.beginDraft()
    const routing = this.draftRouting!
    if (index < 0 || index >= routing.length) return
    routing[index] = { ...routing[index]!, tier }
    this.failed = false
    this.publish()
  }

  private addRoute(): void {
    const snapshot = this.scope.getSnapshot()
    if (this.disposed || snapshot.status !== 'ready' || !snapshot.writable || this.saving) return
    this.beginDraft()
    this.draftRouting!.push({ ...DEFAULT_ROUTE })
    this.failed = false
    this.publish()
  }

  private removeRoute(index: number): void {
    const snapshot = this.scope.getSnapshot()
    if (this.disposed || snapshot.status !== 'ready' || !snapshot.writable || this.saving) return
    this.beginDraft()
    const routing = this.draftRouting!
    if (index < 0 || index >= routing.length) return
    routing.splice(index, 1)
    this.failed = false
    this.publish()
  }

  private setExpertQuota(field: keyof GatewayExpertQuota, value: number): void {
    const snapshot = this.scope.getSnapshot()
    if (this.disposed || snapshot.status !== 'ready' || !snapshot.writable || this.saving) return
    this.beginDraft()
    this.draftExpertQuota = { ...this.draftExpertQuota!, [field]: value }
    this.failed = false
    this.publish()
  }

  private setTokenBudget(field: keyof GatewayTokenBudget, value: number): void {
    const snapshot = this.scope.getSnapshot()
    if (this.disposed || snapshot.status !== 'ready' || !snapshot.writable || this.saving) return
    this.beginDraft()
    this.draftTokenBudget = { ...this.draftTokenBudget!, [field]: value }
    this.failed = false
    this.publish()
  }

  private clearDraft(): void {
    this.draftEnabled = undefined
    this.draftRouting = undefined
    this.draftExpertQuota = undefined
    this.draftTokenBudget = undefined
    this.draftRevision = undefined
    this.failed = false
    this.conflicted = false
  }

  private discard(): void {
    if (this.saving) return
    this.clearDraft()
    this.publish()
  }

  private async save(): Promise<void> {
    const snapshot = this.scope.getSnapshot()
    const desiredEnabled = this.enabled()
    const desiredRouting = this.desiredRouting()
    const desiredExpertQuota = this.desiredExpertQuota()
    const desiredTokenBudget = this.desiredTokenBudget()
    const sharesInvalid = !sharesSumTo1(desiredTokenBudget)
    if (this.disposed || snapshot.status !== 'ready' || !snapshot.writable || this.saving
      || (this.currentEnabled() === desiredEnabled
        && shallowEqualRouting(this.currentRouting(), desiredRouting)
        && shallowEqualQuota(this.currentExpertQuota(), desiredExpertQuota)
        && shallowEqualBudget(this.currentTokenBudget(), desiredTokenBudget))
      || sharesInvalid) return
    if (this.draftRouting !== undefined && snapshot.revision !== this.draftRevision) {
      this.conflicted = true
      this.publish()
      return
    }
    const generation = this.saveGeneration
    this.saving = true
    this.failed = false
    this.conflicted = false
    this.publish()
    await this.scope.mutate([
      { op: 'set', path: ['enabled'], value: desiredEnabled },
      { op: 'set', path: ['routing'], value: desiredRouting.map(route => ({ ...route })) },
      { op: 'set', path: ['expertQuota'], value: { ...desiredExpertQuota } },
      { op: 'set', path: ['tokenBudget'], value: { ...desiredTokenBudget } },
    ], this.draftRevision)
    if (generation !== this.saveGeneration) return
    const landed = this.currentEnabled() === desiredEnabled
      && shallowEqualRouting(this.currentRouting(), desiredRouting)
      && shallowEqualQuota(this.currentExpertQuota(), desiredExpertQuota)
      && shallowEqualBudget(this.currentTokenBudget(), desiredTokenBudget)
    this.saving = false
    this.failed = !landed
    if (landed) this.clearDraft()
    this.publish()
  }

  private projection(): ModelGatewayCardState {
    const snapshot = this.scope.getSnapshot()
    const desiredRouting = this.desiredRouting()
    const desiredExpertQuota = this.desiredExpertQuota()
    const desiredTokenBudget = this.desiredTokenBudget()
    return {
      available: snapshot.status === 'ready',
      writable: snapshot.writable,
      dirty: this.currentEnabled() !== this.enabled()
        || !shallowEqualRouting(this.currentRouting(), desiredRouting)
        || !shallowEqualQuota(this.currentExpertQuota(), desiredExpertQuota)
        || !shallowEqualBudget(this.currentTokenBudget(), desiredTokenBudget),
      invalid: !sharesSumTo1(desiredTokenBudget),
      saving: this.saving,
      failed: this.failed,
      enabled: this.enabled(),
      routing: desiredRouting.map(route => ({ ...route })),
      expertQuota: { ...desiredExpertQuota },
      tokenBudget: { ...desiredTokenBudget },
      conflicted: this.conflicted,
      sharesInvalid: !sharesSumTo1(desiredTokenBudget),
      catalogProviders: this.catalogProviders,
      catalogModels: this.catalogModels,
    }
  }

  private publish(): void {
    this.store.set(this.projection())
  }
}
