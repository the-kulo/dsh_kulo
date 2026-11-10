/**
 * Models settings section: the provider rows joined from the configurable
 * directory, settings namespaces, and credential states, with one editor
 * card at a time. Rows retain the account-first order supplied by the store
 * and expose only confirmed API-key state through accessible
 * solid configured or missing dots. A whole-section provider without a
 * configured key renders as its open setup card instead of a row, but only in
 * the first-run posture — no provider on the page can serve requests yet — and
 * only until the user closes that card. The add flow is one card behind one
 * button: a mode switch chooses between adopting a dormant directory provider
 * (the catalog select over the provider editor) and declaring a custom model
 * API (the create form). A panel mounts the first time its mode is shown and
 * stays mounted, hidden, while the card is open and its mode stays offered,
 * so switching modes discards neither draft and an unvisited mode costs
 * nothing; the switch holds still while either panel has a write or an
 * endpoint interrogation in flight, since a switch underneath one would
 * orphan the answer. Each card kind owns its own open state, so closing one
 * never discards a draft in another. Every
 * mutation writes through the wire, while a provider removal first requires
 * confirmation; the page re-renders from pushed invalidations or the
 * post-apply reload.
 */

import { useId, useState } from 'react'
import type { ReactNode } from 'react'
import { Button, IconPlusOutlineRegular, Modal, SegmentedControl } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsRenderSlots } from '@deepseek-ai/dsh-client-ui-slots'
import type {
  LlmDiscoveredModel, LlmNativeAuth, SettingsNamespaceView, SettingsPathOpView,
} from '@deepseek-ai/dsh-api-remotes/client'
import type { JsonValue } from '@deepseek-ai/dsh-util-values'
// Type-only: pulls this package's SlotMap merge (the two Models child slots).
import type {} from './slot-contract.ts'
import { CustomProviderCard } from './CustomProviderCard.tsx'
import { modelDrafts } from './DeepSeekModelsEditor.tsx'
import { deriveKeyRef, protocolChoices, providerUsable, reasoningLevelChoices } from './store.ts'
import type { ModelsSettingsStore, ProviderRow } from './store.ts'
import type { ModelsOperations } from './operations.ts'
import type { SettingsSchemaOperations } from './schema-operations.ts'
import { ProviderEditor, type ProviderEditorProps } from './ProviderEditor.tsx'
import type { en } from './locales.ts'
import styles from './ModelsSection.module.css'

/** Injected dependencies of {@link ModelsSection} (slot `inject`). */
export interface ModelsSectionInjected {
  /** The page store (loaded on mount, refreshed on pushed invalidations). */
  controller: ModelsSettingsStore
  hooks: {
    /** Page snapshot bound by the UI renderer as useSnapshot. */
    snapshot: ModelsSettingsStore['store']
  }
  /** The Host operations the section and its cards invoke. */
  operations: ModelsOperations
  /** Settings schema and immutable path callbacks. */
  schema: SettingsSchemaOperations
  /** Section copy. */
  t: (key: keyof typeof en) => string
}

/**
 * The two ways the add card gains a provider: adopt a directory row the
 * adapter already knows, or declare a route it does not.
 */
type AddMode = 'catalog' | 'custom'

/** The child slots this section declares and dispatches (see ./slot-contract.ts). */
type ModelsChildSlots = 'settings.models.provider-card' | 'settings.models.footer'

/** The child-slot dispatch function the renderer binds for the section. */
type ModelsRenderSlot = PropsRenderSlots<ModelsChildSlots>['renderSlot']

/**
 * Props delivered by the slot outlet: the inject face spread flat (the
 * renderer erases the share boundary at the render call) plus the child-slot
 * dispatch seat. The seat is required: the renderer binds it at the render
 * call itself — unlike the inject face it is never absent at runtime — and a
 * direct render that forgets it fails to compile instead of mounting nothing.
 */
export type ModelsSectionProps = Partial<InjectFace<ModelsSectionInjected>> & PropsRenderSlots<ModelsChildSlots>

type ModelsSectionFace = InjectFace<ModelsSectionInjected>

/** Provider identity shared by row actions and confirmation copy. */
export interface ProviderIdentity {
  /** Stable provider route id. */
  provider: string
  /** Human-facing provider name. */
  displayName: string
}

/** One existing row or dormant directory entry addressed by an editor action. */
interface EditorTarget extends ProviderIdentity {
  settingsNs: string
  settingsPath: readonly string[]
  /** Writable credential identified under this page's conventional reference. */
  credentialRef?: string
  /** The adapter reports this route as one it does not ship (see {@link ProviderEditorProps.declared}). */
  declared?: boolean
  /** The route's catalog endpoint (see {@link ProviderEditorProps.defaultBaseURL}). */
  defaultBaseURL?: string
  /** Environment used to construct an endpoint (see {@link ProviderEditorProps.baseURLEnv}). */
  baseURLEnv?: readonly string[]
  /** The route's native authentication (see {@link ProviderEditorProps.nativeAuth}). */
  nativeAuth?: LlmNativeAuth
}

/** A dormant directory row the add card can adopt, with its registered namespace. */
interface AddableRow {
  row: ProviderRow
  namespace: SettingsNamespaceView
}

/** The catalog draft the add card shows: its editor target and the namespace that takes the write. */
interface CatalogDraft {
  target: EditorTarget
  namespace: SettingsNamespaceView
}

/** Values that vary around the shared provider-editor rendering. */
interface ProviderEditorRenderProps extends Pick<
  ProviderEditorProps,
  'namespace' | 'schema' | 'operations' | 't' | 'readOnly' | 'onClose'
> {
  target: EditorTarget
  row: ProviderRow
}

/** Render an editor for either the setup posture or an expanded provider row. */
function renderProviderEditor({ target, row, ...props }: ProviderEditorRenderProps): ReactNode {
  return (
    <ProviderEditor
      provider={target.provider}
      displayName={target.displayName}
      settingsPath={target.settingsPath}
      {...target.declared === true ? { declared: true } : {}}
      {...target.defaultBaseURL === undefined ? {} : { defaultBaseURL: target.defaultBaseURL }}
      {...target.baseURLEnv === undefined ? {} : { baseURLEnv: target.baseURLEnv }}
      {...target.nativeAuth === undefined ? {} : { nativeAuth: target.nativeAuth }}
      {...row.credential === undefined ? {} : { credential: row.credential }}
      {...row.credentialChecks === undefined ? {} : { credentialChecks: row.credentialChecks }}
      {...row.runtimeModels === undefined ? {} : { runtimeModels: row.runtimeModels }}
      {...props}
    />
  )
}

/**
 * Remove one user-added provider and its page-managed credential. Credential
 * removal comes first so a second-step failure leaves the provider row visible
 * and the whole operation safely retryable; both unsets are idempotent.
 * The settings removal names the profile rather than rebuilding its whole
 * namespace from a partial view.
 * @param operations - the page's Host operations.
 * @param controller - the page store to refresh.
 * @param target - the provider's settings address and optional managed credential.
 * @returns the failure message, or undefined once the write and reload landed.
 */
export async function removeProviderProfile(
  operations: ModelsOperations,
  controller: ModelsSettingsStore,
  target: { settingsNs: string; settingsPath: readonly string[]; credentialRef?: string },
): Promise<string | undefined> {
  if (target.credentialRef !== undefined) {
    const credential = await operations.removeCredential(target.credentialRef)
    if (credential !== undefined) return credential
  }
  const written = await operations.writeSettings(
    target.settingsNs,
    [{ op: 'unset', path: [...target.settingsPath] }],
    undefined,
  )
  if (written.kind !== 'written') return written.message
  await controller.load()
  return undefined
}

/** A numeric profile field, read without assuming the subtree is present. */
function numberAt(value: unknown, key: string): number | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const field = Reflect.get(value, key)
  return typeof field === 'number' ? field : undefined
}

/**
 * What one route's endpoint discloses about the models it serves, by id. A
 * gateway that publishes no capacities answers with ids alone — the same
 * listing the runtime catalog exposes, and the reason a sync cannot invent
 * them.
 * @param operations - the page's Host operations.
 * @param settingsNs - namespace whose adapter family interrogates the endpoint.
 * @param provider - configured route to ask.
 * @returns advertised models by id; empty when the route cannot be interrogated.
 */
async function advertisedModels(
  operations: ModelsOperations,
  settingsNs: string,
  provider: string,
): Promise<ReadonlyMap<string, LlmDiscoveredModel>> {
  const answer = await operations.discoverModels(settingsNs, { provider })
  if (answer.kind !== 'found') return new Map()
  return new Map(answer.models.map(model => [model.id, model]))
}

/**
 * Write the models a refresh discovered into the stored list of every route
 * that already declares one.
 *
 * A refresh only fills the runtime catalog every selector reads, which no
 * provider card draws from: the card shows the stored list, so the endpoint's
 * new models have to be written there to appear. Only a route that already
 * declares models is extended — a route served from the installed catalog names
 * no list, and materializing one would replace the catalog those models
 * describe. Additions keep the configured rows untouched; a model the endpoint
 * dropped is left for the card's own fetch flow, which previews the whole list.
 *
 * Added rows carry the endpoint's own name and capacities when the listing
 * discloses them, otherwise the capacities the profile already applies to a
 * model it does not name — the values the runtime resolves today, written out
 * so the card shows numbers the user can correct. A stored row that names no
 * capacity at all is sized the same way; one that names any keeps exactly what
 * it names, so a correction survives later refreshes.
 * @param operations - the page's Host operations.
 * @param controller - the page store, reloaded first so the sync sees the
 * refreshed runtime catalog.
 * @param schema - settings path reads over the namespace views.
 * @returns one entry per route the settings document refused to change.
 */
async function syncDiscoveredModels(
  operations: ModelsOperations,
  controller: ModelsSettingsStore,
  schema: SettingsSchemaOperations,
): Promise<readonly { provider: string; reason: string }[]> {
  await controller.load()
  const snapshot = controller.store.getSnapshot()
  if (!snapshot.writable) return []
  // One write per namespace: every provider of one adapter shares it, and a
  // write advances the revision the next one would be fenced to.
  const pending = new Map<string, { revision: number; ops: SettingsPathOpView[]; providers: string[] }>()
  for (const row of snapshot.rows) {
    if (row.entry.provider === 'deepseek-account') continue
    if (row.entry.settingsNs !== 'llm-pi-ai') continue
    if (row.runtimeModels === undefined || row.runtimeModels.length === 0) continue
    const namespace = snapshot.namespaces.get(row.entry.settingsNs)
    if (namespace === undefined) continue
    const modelsPath = [...row.entry.settingsPath, 'models']
    const stored = modelDrafts(schema.getPath(namespace.value, modelsPath))
    if (stored.length === 0) continue
    const advertised = await advertisedModels(operations, row.entry.settingsNs, row.entry.provider)
    const profile = schema.getPath(namespace.value, row.entry.settingsPath)
    const routeContextWindow = numberAt(profile, 'defaultContextWindow')
    const routeMaxTokens = numberAt(profile, 'defaultMaxTokens')
    const capacities = (id: string | undefined): Record<string, number> => {
      const found = id === undefined ? undefined : advertised.get(id)
      const contextWindow = found?.contextWindow ?? routeContextWindow
      const maxTokens = found?.maxTokens ?? routeMaxTokens
      return {
        ...contextWindow === undefined ? {} : { contextWindow },
        ...maxTokens === undefined ? {} : { maxTokens },
      }
    }
    let changed = false
    const kept = stored.map((model) => {
      // A row that names any capacity keeps exactly what it names. Only a row
      // that sizes nothing is filled, where the route default is the value the
      // runtime already resolves, so no refresh can overwrite a correction.
      if (typeof model.contextWindow === 'number' || typeof model.maxTokens === 'number') return model
      const additions = capacities(typeof model.id === 'string' ? model.id : undefined)
      if (Object.keys(additions).length === 0) return model
      changed = true
      return { ...model, ...additions }
    })
    const declared = new Set(stored.flatMap(model => typeof model.id === 'string' ? [model.id] : []))
    const added = row.runtimeModels.filter(id => !declared.has(id)).map((id) => {
      changed = true
      const found = advertised.get(id)
      const name = found?.name === undefined || found.name === id ? undefined : found.name
      return { id, ...name === undefined ? {} : { name }, ...capacities(id) }
    })
    if (!changed) continue
    const value = [...kept, ...added] as JsonValue
    const op: SettingsPathOpView = { op: 'set', path: modelsPath, value }
    const entry = pending.get(row.entry.settingsNs)
    if (entry === undefined) pending.set(row.entry.settingsNs, { revision: namespace.revision, ops: [op], providers: [row.entry.provider] })
    else {
      entry.ops.push(op)
      entry.providers.push(row.entry.provider)
    }
  }
  const synced: string[] = []
  const failures: { provider: string; reason: string }[] = []
  for (const [ns, { revision, ops, providers }] of pending) {
    const written = await operations.writeSettings(ns, ops, revision)
    if (written.kind === 'written') synced.push(...providers)
    else { for (const provider of providers) failures.push({ provider, reason: written.message }) }
  }
  if (synced.length > 0) await controller.load()
  return failures
}

/**
 * Whether a whole-section provider still needs its first key: an unconfigured
 * credential opens the setup card instead of showing a row. This is the
 * first-run posture alone — a user who can already reach some provider gets an
 * ordinary row with the missing-key dot, since nothing here is blocking them.
 * @param row - the joined provider row.
 * @param anyUsable - whether any joined row can already serve requests.
 * @returns whether to render the setup card.
 */
export function needsSetup(row: ProviderRow, anyUsable: boolean): boolean {
  if (anyUsable || row.entry.provider === 'deepseek-account') return false
  if (row.entry.settingsPath.length > 0) return false
  return row.credential?.configured !== true
}

/**
 * The provider-card seat's credential fact: the reference this page would use
 * for the row — the profile's `apiKeyEnv`, or the page's derived
 * `<ROUTE>_API_KEY` while the profile names none — confirmed configured. The
 * derived half is what keeps the seat consistent with the editor on the
 * add-provider draft, whose dormant row names no reference yet.
 */
function keyConfiguredOf(row: ProviderRow): boolean {
  return row.apiKeyEnv !== undefined
    ? row.credential?.configured === true
    : row.derivedCredential?.configured === true
}

function targetOf(row: ProviderRow): EditorTarget {
  const managedRef = deriveKeyRef(row.entry.provider)
  const credentialRef = row.apiKeyEnv === managedRef
    && row.credential?.configured === true
    && row.credential.writable
    ? managedRef
    : undefined
  return {
    provider: row.entry.provider,
    displayName: row.entry.displayName,
    settingsNs: row.entry.settingsNs,
    settingsPath: row.entry.settingsPath,
    ...credentialRef === undefined ? {} : { credentialRef },
    // Only declared routes may expose route-owned fields.
    ...row.entry.declared === true ? { declared: true } : {},
    ...row.entry.defaultBaseURL === undefined ? {} : { defaultBaseURL: row.entry.defaultBaseURL },
    ...row.entry.baseURLEnv === undefined ? {} : { baseURLEnv: row.entry.baseURLEnv },
    ...row.entry.nativeAuth === undefined ? {} : { nativeAuth: row.entry.nativeAuth },
  }
}

/** Stable visible and accessible identity for one provider target. */
export function providerTargetLabel(target: ProviderIdentity): string {
  return target.provider === target.displayName
    ? target.provider
    : `${target.displayName} (${target.provider})`
}

/** Replace the one provider placeholder in localized destructive-action copy. */
export function providerCopy(template: string, target: ProviderIdentity): string {
  return template.replace('{provider}', () => providerTargetLabel(target))
}

/**
 * Render the Models section content column.
 * @param props - slot-delivered injected dependencies.
 * @returns the section, or null while the shell has not injected yet.
 */
export function ModelsSection(props: ModelsSectionProps): ReactNode {
  const { controller, useSnapshot, operations, schema, t, renderSlot } = props
  if (
    controller === undefined || useSnapshot === undefined || operations === undefined
    || schema === undefined || t === undefined
  ) return null
  return <Loaded injected={{ controller, useSnapshot, operations, schema, t }} renderSlot={renderSlot} />
}

function Loaded({ injected, renderSlot }: { injected: ModelsSectionFace; renderSlot: ModelsRenderSlot }): ReactNode {
  const { controller, operations, schema, t } = injected
  const snapshot = injected.useSnapshot(value => value)
  const state = { ...snapshot, rows: snapshot.rows.map(row => row.entry.provider === 'deepseek-account'
    ? { ...row, entry: { ...row.entry, displayName: t('deepSeekAccount') } } : row) }
  /** A new or failed surface waits for a current snapshot; background refreshes preserve its drafts. */
  const [hasReadySnapshot, setHasReadySnapshot] = useState(state.status === 'ready')
  if (state.status === 'ready' && !hasReadySnapshot) setHasReadySnapshot(true)
  if (state.status === 'error' && hasReadySnapshot) setHasReadySnapshot(false)
  const [editing, setEditing] = useState<EditorTarget | undefined>(undefined)
  const [addOpen, setAddOpen] = useState(false)
  const [addMode, setAddMode] = useState<AddMode>('catalog')
  /** The modes shown since the add card opened; each keeps its panel mounted. */
  const [visited, setVisited] = useState<ReadonlySet<AddMode>>(() => new Set())
  /** Whether each add panel has a write or an interrogation in flight. */
  const [catalogBusy, setCatalogBusy] = useState(false)
  const [customBusy, setCustomBusy] = useState(false)
  /** Base of the add card's tab and panel ids. */
  const addId = useId()
  const [deleteTarget, setDeleteTarget] = useState<EditorTarget | undefined>(undefined)
  const [deleting, setDeleting] = useState(false)
  const [deleteFailure, setDeleteFailure] = useState<string | undefined>(undefined)
  const [savedTarget, setSavedTarget] = useState<ProviderIdentity | undefined>(undefined)
  const [dismissedSetup, setDismissedSetup] = useState<ReadonlySet<string>>(() => new Set())
  const [refreshing, setRefreshing] = useState(false)
  const [refreshSuccess, setRefreshSuccess] = useState<string | undefined>(undefined)
  const [refreshError, setRefreshError] = useState<string | undefined>(undefined)
  const [refreshFailures, setRefreshFailures] = useState<readonly { provider: string; reason: string }[]>([])

  const refreshModels = (): void => {
    if (refreshing || state.status !== 'ready') return
    setRefreshing(true)
    setRefreshSuccess(undefined)
    setRefreshError(undefined)
    setRefreshFailures([])
    // The refresh itself only fills the runtime catalog every selector reads;
    // the card below draws the stored list, so the same models are written into
    // the declared list of each route that names one. That write is what makes
    // the card — and a later restart — show what the endpoint really serves.
    void operations.refreshModels().then(async (outcome) => {
      if (outcome.kind === 'refused') {
        setRefreshError(`${t('loadFailed')}: ${outcome.message}`)
        return
      }
      const failures = outcome.failures.map(failure => ({
        provider: failure.provider,
        reason: failure.reason ?? failure.provider,
      }))
      const refused = await syncDiscoveredModels(operations, controller, schema)
      setRefreshFailures([...failures, ...refused])
      setRefreshSuccess(outcome.added > 0
        ? t('refreshAdded').replace('{count}', String(outcome.added))
        : t('refreshUpToDate'))
    }).catch((error: unknown) => {
      setRefreshError(`${t('loadFailed')}: ${error instanceof Error ? error.message : String(error)}`)
    }).finally(() => { setRefreshing(false) })
  }

  const announceSaved = (target: ProviderIdentity): void => {
    // Announced only once the refreshed directory is in the snapshot the
    // notice reads its name from: an apply can rename the route, and the
    // target captured when the card opened still carries the old name.
    void controller.load().then(() => { setSavedTarget(target) })
  }

  /**
   * Close the add card whole. The catalog target is forgotten with it, since
   * `editing` doubles as the row editor's target once the card is closed and a
   * refresh could otherwise open the row of a provider the draft never saved.
   * The busy flags reset here because a panel that closes itself on success
   * unmounts before it can report idle.
   */
  const closeAdd = (): void => {
    setEditing(undefined)
    setAddOpen(false)
    setCatalogBusy(false)
    setCustomBusy(false)
  }

  const closeEditor = (changed: boolean, target: ProviderIdentity): void => {
    closeAdd()
    if (changed) announceSaved(target)
  }

  /**
   * Close a setup card, which owns none of the state above: the row-editor
   * and add cards each own one of those, so clearing them here would discard
   * a draft the user opened beside this card. Dismissal is this card's own —
   * the provider falls back to an ordinary row for the rest of the session,
   * and reopens through Edit.
   */
  const closeSetup = (changed: boolean, target: ProviderIdentity): void => {
    setDismissedSetup(previous => new Set([...previous, target.provider]))
    if (changed) announceSaved(target)
  }

  const closeDelete = (): void => {
    if (deleting) return
    setDeleteTarget(undefined)
    setDeleteFailure(undefined)
  }

  const confirmDelete = (): void => {
    /* v8 ignore next -- the action only renders with a target and is disabled while a deletion is pending */
    if (deleteTarget === undefined || deleting) return
    setDeleting(true)
    setDeleteFailure(undefined)
    void removeProviderProfile(operations, controller, deleteTarget)
      .then((failure) => {
        if (failure !== undefined) {
          setDeleteFailure(failure)
          return
        }
        setDeleteTarget(undefined)
      })
      .finally(() => { setDeleting(false) })
  }

  if (state.status === 'idle') void controller.load()
  if (state.status === 'error') {
    /* v8 ignore next -- an error status always carries text; the fallback satisfies the nullable type */
    const errorText = state.error ?? ''
    return (
      <div className={styles['section']}>
        <p className={styles['error']}>{`${t('loadFailed')}: ${errorText}`}</p>
        <button type="button" className={styles['secondaryButton']} onClick={() => { void controller.load() }}>
          {t('retry')}
        </button>
      </div>
    )
  }
  if (!hasReadySnapshot && state.status !== 'ready') {
    return (
      <div className={styles['section']}>
        <h2 className={styles['title']}>{t('title')}</h2>
        <p className={styles['intro']}>{t('intro')}</p>
      </div>
    )
  }

  // The saved provider as the directory currently names it. The route id is
  // what the apply cannot change, so it is what the notice is keyed by; a row
  // the same apply removed keeps the captured identity, since nothing newer
  // exists to name it with.
  const savedRow = savedTarget === undefined
    ? undefined
    : state.rows.find(row => row.entry.provider === savedTarget.provider)
  const savedIdentity = savedRow === undefined
    ? savedTarget
    : { provider: savedRow.entry.provider, displayName: savedRow.entry.displayName }

  // One fact decides both first-run postures on this page and the onboarding
  // step: whether the user already has a provider to talk to.
  const anyUsable = state.rows.some(providerUsable)
  const configured = state.rows.filter(row => row.configured)
  const configurable = state.rows.filter(row => state.namespaces.has(row.entry.settingsNs))
  const addable: AddableRow[] = state.rows.flatMap((row) => {
    const namespace = state.namespaces.get(row.entry.settingsNs)
    return namespace === undefined || row.configured ? [] : [{ row, namespace }]
  })
  // Hand-declared routes live in the pi-ai namespace, which is also the only
  // one whose schema names the protocols one may speak; without it mounted
  // there is nothing to declare and the mode is not offered.
  const piAi = state.namespaces.get('llm-pi-ai')
  const protocols = protocolChoices(piAi, schema)
  const reasoningLevels = reasoningLevelChoices(piAi, schema)
  // Each mode is offered while its namespace is mounted and enabled while it
  // has something to offer; the card shows the chosen mode where both are
  // offered, else the only one there is. A mode's panel is mounted while it is
  // the shown mode or has been shown since the card opened — derived, so a
  // refresh that changes which modes are offered can never leave the card
  // without a panel.
  const catalogOffered = configurable.length > 0
  const catalogEnabled = addable.length > 0
  const customOffered = piAi !== undefined
  const customEnabled = protocols.length > 0
  const bothOffered = catalogOffered && customOffered
  const mode: AddMode = bothOffered ? addMode : customOffered ? 'custom' : 'catalog'
  const mounted = (candidate: AddMode): boolean => mode === candidate || visited.has(candidate)
  const switchLocked = catalogBusy || customBusy
  // The catalog draft: the row the user chose, kept through a refresh that
  // adopts or withdraws it elsewhere so a typed key is never discarded, for as
  // long as its namespace can still take the write; else the first row still
  // addable, since the mode can be entered by a refresh as well as by the
  // switch and the button only picks a target when it opens the card.
  const draft = ((): CatalogDraft | undefined => {
    if (!addOpen || !catalogOffered) return undefined
    const kept = editing === undefined ? undefined : state.namespaces.get(editing.settingsNs)
    if (editing !== undefined && kept !== undefined) return { target: editing, namespace: kept }
    const first = addable[0]
    return first === undefined ? undefined : { target: targetOf(first.row), namespace: first.namespace }
  })()
  // The draft's directory row, for the card extension seat. A refresh can drop
  // the row mid-draft (the route was adopted or withdrawn elsewhere); the
  // draft card stays while the seat simply has no row to dispatch.
  const addRow = draft === undefined
    ? undefined
    : state.rows.find(row => row.entry.provider === draft.target.provider)

  return (
    <div className={styles['section']}>
      <h2 className={styles['title']}>{t('title')}</h2>
      <p className={styles['intro']}>{t('intro')}</p>
      {!state.writable && state.status === 'ready' ? <p className={styles['notice']}>{t('readOnly')}</p> : null}
      <div className={styles['refreshRow']}>
        <button
          type="button"
          className={styles['secondaryButton']}
          disabled={refreshing || state.status !== 'ready'}
          onClick={refreshModels}
        >
          {refreshing ? t('refreshingModels') : t('refreshModels')}
        </button>
        {refreshSuccess === undefined ? null : <p className={styles['savedNotice']} role="status">{refreshSuccess}</p>}
        {refreshError === undefined ? null : <p className={styles['error']} role="alert">{refreshError}</p>}
        {refreshFailures.map(failure => (
          <p key={failure.provider} className={styles['error']}>{failure.provider}: {failure.reason}</p>
        ))}
      </div>
      {savedIdentity === undefined
        ? null
        : (
          <p className={styles['savedNotice']} role="status" aria-live="polite">
            {providerCopy(t('savedProvider'), savedIdentity)}
          </p>
        )}
      <ul className={styles['rows']}>
        {configured.map((row) => {
          const target = targetOf(row)
          const namespace = state.namespaces.get(target.settingsNs)
          /* v8 ignore next -- the join marks a row configured only when its namespace resolved */
          if (namespace === undefined) return null
          const error = row.entry.error === undefined
            ? null
            : <p role="alert" className={styles['error']}>{row.entry.error}</p>
          if (needsSetup(row, anyUsable) && !dismissedSetup.has(row.entry.provider)) {
            // First-run posture: the provider exists but has no key — the
            // setup card IS its presence on the page, until the user closes it.
            return (
              <li key={row.entry.provider} className={styles['setupCard']}>
                {error}
                {renderProviderEditor({
                  target,
                  row,
                  namespace,
                  schema,
                  operations,
                  t,
                  readOnly: !state.writable,
                  onClose: (changed) => { closeSetup(changed, target) },
                })}
                {renderSlot(
                  'settings.models.provider-card',
                  { provider: row.entry, configured: row.configured, keyConfigured: keyConfiguredOf(row) },
                  { entryKey: row.entry.settingsNs },
                )}
              </li>
            )
          }
          const open = !addOpen && editing?.provider === row.entry.provider
          const credentialConfigured = row.credential?.configured === true
          const credentialMissing = !credentialConfigured
            && row.apiKeyEnv !== undefined
            && row.credential?.configured === false
          return (
            <li key={row.entry.provider} className={styles['rowCard']}>
              <div className={styles['rowHead']}>
                <span className={styles['rowIdentity']}>
                  <span className={styles['rowName']}>{row.entry.displayName}</span>
                  {/* Only the adapter can tell a hand-declared route from a
                      shipped one it also has a stored profile for, so the tag
                      follows its answer and stays off when it gives none. */}
                  {row.entry.declared === true
                    ? <span className={styles['rowTag']}>{t('customTag')}</span>
                    : null}
                  {/* The store keeps the account row only while the account lists models. */}
                  {row.entry.provider === 'deepseek-account'
                    ? (
                      <span className={styles['accountStatus']}>
                        <span className={`${styles['credentialDot']} ${styles['credentialDotConfigured']}`} aria-hidden="true" />
                        {t('accountSignedIn')}
                      </span>
                    )
                    : null}
                  {credentialConfigured
                    ? (
                      <span
                        className={`${styles['credentialDot']} ${styles['credentialDotConfigured']}`}
                        role="img"
                        aria-label={t('credentialConfigured')}
                        title={t('credentialConfigured')}
                      />
                    )
                    : credentialMissing
                      ? (
                        <span
                          className={`${styles['credentialDot']} ${styles['credentialDotMissing']}`}
                          role="img"
                          aria-label={t('credentialMissing')}
                          title={t('credentialMissing')}
                        />
                      )
                      : null}
                </span>
                <span className={styles['rowActions']}>
                  {/* The account catalog comes from the account listing; its model overrides live in cordis.patch.yml. */}
                  {row.entry.provider === 'deepseek-account'
                    ? null
                    : (
                      <button
                        type="button"
                        className={styles['secondaryButton']}
                        aria-label={providerCopy(t('editProvider'), target)}
                        disabled={!open && state.status !== 'ready'}
                        onClick={() => {
                          if (!open && controller.store.getSnapshot().status !== 'ready') return
                          setSavedTarget(undefined)
                          // One card at a time: the add card closes with whatever
                          // it held, since closing either card would otherwise
                          // discard the other's draft.
                          setAddOpen(false)
                          setEditing(open ? undefined : target)
                        }}
                      >
                        {t('edit')}
                      </button>
                    )}
                  {row.removable
                    ? (
                      <button
                        type="button"
                        className={styles['dangerButton']}
                        aria-label={providerCopy(t('removeProvider'), target)}
                        disabled={!state.writable || state.status !== 'ready'}
                        onClick={() => {
                          if (controller.store.getSnapshot().status !== 'ready') return
                          setSavedTarget(undefined)
                          setDeleteFailure(undefined)
                          setDeleteTarget(target)
                        }}
                      >
                        {t('remove')}
                      </button>
                    )
                    : null}
                </span>
              </div>
              {error}
              {renderSlot(
                'settings.models.provider-card',
                { provider: row.entry, configured: row.configured, keyConfigured: keyConfiguredOf(row) },
                { entryKey: row.entry.settingsNs },
              )}
              {open
                ? renderProviderEditor({
                  target,
                  row,
                  namespace,
                  schema,
                  operations,
                  t,
                  readOnly: !state.writable,
                  onClose: (changed) => { closeEditor(changed, target) },
                })
                : null}
            </li>
          )
        })}
      </ul>
      <div className={styles['addBlock']}>
        {addOpen
          ? (
            <div className={styles['addCard']}>
              <div className={styles['addModes']}>
                {bothOffered
                  ? (
                    <SegmentedControl
                      id={addId}
                      label={t('addMode')}
                      value={mode}
                      disabled={switchLocked}
                      options={[
                        {
                          value: 'catalog',
                          label: t('addCatalog'),
                          disabled: !catalogEnabled,
                          ...catalogEnabled ? {} : { title: t('addCatalogExhausted') },
                        },
                        {
                          value: 'custom',
                          label: t('addCustom'),
                          disabled: !customEnabled,
                          ...customEnabled ? {} : { title: t('addCustomUnavailable') },
                        },
                      ]}
                      onChange={(next) => {
                        setAddMode(next)
                        setVisited(previous => new Set([...previous, next]))
                      }}
                    />
                  )
                  : (
                    // One mode alone has no switch to name it, so the card
                    // carries the mode as its title instead.
                    <div className={styles['editorHeader']}>
                      <span className={styles['editorTitle']}>{t(mode === 'catalog' ? 'addCatalog' : 'addCustom')}</span>
                    </div>
                  )}
                <p className={styles['advancedHint']}>
                  {t(mode === 'catalog' ? 'addCatalogHint' : 'addCustomHint')}
                </p>
              </div>
              {mounted('catalog') && draft !== undefined
                ? (
                  <div
                    id={`${addId}-catalog-panel`}
                    {...bothOffered ? { role: 'tabpanel', 'aria-labelledby': `${addId}-catalog` } : {}}
                    hidden={mode !== 'catalog'}
                    className={styles['addPanel']}
                  >
                    <div className={styles['field']}>
                      <span className={styles['fieldLabel']}>{t('provider')}</span>
                      <select
                        className={`${styles['input']} ${styles['selectInput']}`}
                        value={draft.target.provider}
                        aria-label={t('provider')}
                        disabled={catalogBusy}
                        onChange={(event) => {
                          const picked = addable.find(candidate => candidate.row.entry.provider === event.target.value)
                          /* v8 ignore next -- the select only lists addable rows */
                          if (picked === undefined) return
                          setEditing(targetOf(picked.row))
                        }}
                      >
                        {addable.map(({ row }) => (
                          <option key={row.entry.provider} value={row.entry.provider}>{row.entry.displayName}</option>
                        ))}
                      </select>
                    </div>
                    <ProviderEditor
                      key={draft.target.provider}
                      provider={draft.target.provider}
                      displayName={draft.target.displayName}
                      hideTitle
                      namespace={draft.namespace}
                      schema={schema}
                      settingsPath={draft.target.settingsPath}
                      operations={operations}
                      {...draft.target.defaultBaseURL === undefined ? {} : { defaultBaseURL: draft.target.defaultBaseURL }}
                      {...draft.target.baseURLEnv === undefined ? {} : { baseURLEnv: draft.target.baseURLEnv }}
                      {...draft.target.nativeAuth === undefined ? {} : { nativeAuth: draft.target.nativeAuth }}
                      {...addRow?.credentialChecks === undefined ? {} : { credentialChecks: addRow.credentialChecks }}
                      t={t}
                      readOnly={!state.writable}
                      onClose={(changed) => { closeEditor(changed, draft.target) }}
                      onBusyChange={setCatalogBusy}
                    />
                    {addRow === undefined
                      ? null
                      : renderSlot(
                        'settings.models.provider-card',
                        { provider: addRow.entry, configured: addRow.configured, keyConfigured: keyConfiguredOf(addRow) },
                        { entryKey: addRow.entry.settingsNs },
                      )}
                  </div>
                )
                : null}
              {mounted('custom') && piAi !== undefined
                ? (
                  <div
                    id={`${addId}-custom-panel`}
                    {...bothOffered ? { role: 'tabpanel', 'aria-labelledby': `${addId}-custom` } : {}}
                    hidden={mode !== 'custom'}
                    className={styles['addPanel']}
                  >
                    <CustomProviderCard
                      taken={state.rows.map(row => row.entry.provider)}
                      protocols={protocols}
                      reasoningLevels={reasoningLevels}
                      revision={piAi.revision}
                      operations={operations}
                      t={t}
                      readOnly={!state.writable}
                      onClose={(changed) => {
                        closeAdd()
                        if (changed) void controller.load()
                      }}
                      onBusyChange={setCustomBusy}
                    />
                  </div>
                )
                : null}
            </div>
          )
          : catalogOffered || customOffered
            ? (
              // One entry for both ways to gain a provider; the card behind it
              // splits them. Full width, so it lines up with the rows above.
              <div className={styles['addActions']}>
                <button
                  type="button"
                  className={styles['addButton']}
                  disabled={!state.writable || state.status !== 'ready' || (!catalogEnabled && !customEnabled)}
                  onClick={() => {
                    if (controller.store.getSnapshot().status !== 'ready') return
                    const first = addable[0]
                    const initial: AddMode = catalogEnabled ? 'catalog' : 'custom'
                    setSavedTarget(undefined)
                    setEditing(first === undefined ? undefined : targetOf(first.row))
                    setAddMode(initial)
                    setVisited(new Set([initial]))
                    setAddOpen(true)
                  }}
                >
                  <IconPlusOutlineRegular size={14} />
                  {t('add')}
                </button>
              </div>
            )
            : null}
      </div>
      {renderSlot('settings.models.footer', {})}
      <Modal
        open={deleteTarget !== undefined}
        onClose={closeDelete}
        title={deleteTarget === undefined ? '' : providerCopy(t('deleteTitle'), deleteTarget)}
        closeLabel={t('close')}
        description={deleteTarget === undefined
          ? ''
          : providerCopy(
            deleteTarget.credentialRef === undefined
              ? t('deleteDescription')
              : t('deleteDescriptionWithCredential'),
            deleteTarget,
          )}
        className={styles['deleteDialog'] as string}
        footer={(
          <>
            <Button variant="outline" data-modal-autofocus disabled={deleting} onClick={closeDelete}>
              {t('cancel')}
            </Button>
            <Button
              variant="outline"
              className={styles['deleteConfirm']}
              disabled={deleting}
              onClick={confirmDelete}
            >
              {deleteTarget === undefined
                ? ''
                : providerCopy(deleting ? t('deleting') : t('deleteConfirm'), deleteTarget)}
            </Button>
          </>
        )}
      >
        {deleteFailure === undefined ? null : <p className={styles['error']}>{deleteFailure}</p>}
      </Modal>
    </div>
  )
}
