/** Settings section for the model gateway routing board, expert quota, and token budget. */

import { useId, useState } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { Button, IconPlusOutlineRegular, Modal, Switch, Tag, Tooltip, type TagTone } from '@deepseek-ai/dsh-client-ui-primitives'
import type {
  GatewayCategory, GatewayRouteEntry, GatewayTier, GatewayZone,
  ModelGatewayCardFace, ModelGatewayCardState,
} from './model-gateway-card-controller.ts'
import {
  CATEGORY_OPTIONS, TIER_OPTIONS, ZONE_OPTIONS,
} from './model-gateway-card-controller.ts'
import type { ModelGatewayLocaleKey } from './locales.ts'
import css from './ModelGatewaySection.module.css'

/** Registration-side face for the model gateway settings section. */
export type ModelGatewaySectionFace = Pick<ModelGatewayCardFace,
  'hooks' | 'toggleEnabled' | 'save' | 'discard'
  | 'setRouteProvider' | 'setRouteModel' | 'setRouteZone' | 'setRouteCategory' | 'setRouteTier'
  | 'addRoute' | 'removeRoute'
  | 'setExpertQuota' | 'setTokenBudget'
>

/** Framework-derived props for the model gateway settings section. */
export type ModelGatewaySectionProps = PropsRuntime<'settings.section'>
  & PropsLocale<'settings.model-gateway'>
  & InjectFace<ModelGatewaySectionFace>

type Translate = (key: ModelGatewayLocaleKey) => string

/** Tier badge palette: distinct tone per tier, all through `Tag`. */
const TIER_TONE: Record<GatewayTier, TagTone> = {
  expert: 'warning',
  pool: 'info',
  local: 'success',
}

const TIER_COLOR: Record<GatewayTier, string> = {
  expert: 'var(--dsw-alias-state-warning-primary)',
  pool: 'var(--dsw-alias-state-info-primary)',
  local: 'var(--dsw-alias-state-success-primary)',
}

/** Which route the editor is opening: an existing row or a new one per zone. */
type EditorTarget =
  | { kind: 'edit', index: number }
  | { kind: 'create', zone: GatewayZone }

/**
 * Render the model gateway settings form with the routing board, expert quota, and token budget.
 * @param props - Locale, the gateway form snapshot, and its actions.
 * @returns the model-gateway settings form.
 */
export function ModelGatewaySection(props: ModelGatewaySectionProps) {
  const { t } = props
  const state = props.useModelGatewayCard(snapshot => snapshot)
  const [target, setTarget] = useState<EditorTarget | null>(null)
  const closeEditor = () => { setTarget(null) }
  const actions = {
    onProvider: props.setRouteProvider,
    onModel: props.setRouteModel,
    onZone: props.setRouteZone,
    onCategory: props.setRouteCategory,
    onTier: props.setRouteTier,
    onRemove: props.removeRoute,
    onAdd: props.addRoute,
  }
  return (
    <section className={css.section}>
      <h2 className={css.title}>{t('gatewayTitle')}</h2>
      <p className={css.description}>{t('gatewayDescription')}</p>
      {state.available
        ? (
          <div className={css.body}>
            <div className={css.card}>
              <div className={css.cardHeader}>
                <h3 className={css.cardTitle}>{t('gatewayEnabled')}</h3>
                <p className={css.cardHint}>{t('gatewayEnabledHint')}</p>
              </div>
              <div className={css.toggleRow}>
                <span className={css.toggleLabel}>{t('gatewayEnabled')}</span>
                <Switch
                  checked={state.enabled}
                  label={t('gatewayEnabled')}
                  disabled={!state.writable || state.saving}
                  onChange={props.toggleEnabled}
                />
              </div>
            </div>

            <div className={css.card}>
              <div className={css.cardHeader}>
                <h3 className={css.cardTitle}>{t('routingTitle')}</h3>
                <p className={css.cardHint}>{t('routingDescription')}</p>
                <p className={css.cardHint}>{t('routingBoardHint')}</p>
              </div>
              <RoutingBoard
                state={state}
                t={t}
                disabled={!state.writable || state.saving}
                onEdit={index => { setTarget({ kind: 'edit', index }) }}
                onAdd={zone => { setTarget({ kind: 'create', zone }) }}
              />
            </div>

            <div className={css.card}>
              <div className={css.cardHeader}>
                <h3 className={css.cardTitle}>{t('expertQuotaTitle')}</h3>
              </div>
              <div className={css.numberGrid}>
                <NumberField
                  label={t('expertQuotaDailyCallLimit')}
                  hint={t('expertQuotaDailyCallLimitUnit')}
                  value={state.expertQuota.dailyCallLimit}
                  disabled={!state.writable || state.saving}
                  onChange={value => { props.setExpertQuota('dailyCallLimit', value) }}
                />
                <NumberField
                  label={t('expertQuotaMaxEscalations')}
                  hint={t('expertQuotaMaxEscalationsUnit')}
                  value={state.expertQuota.maxEscalationsPerTask}
                  disabled={!state.writable || state.saving}
                  onChange={value => { props.setExpertQuota('maxEscalationsPerTask', value) }}
                />
                <NumberField
                  label={t('expertQuotaContextBudget')}
                  hint={t('expertQuotaContextBudgetUnit')}
                  value={state.expertQuota.contextBudgetTokens}
                  disabled={!state.writable || state.saving}
                  onChange={value => { props.setExpertQuota('contextBudgetTokens', value) }}
                />
              </div>
            </div>

            <div className={css.card}>
              <div className={css.cardHeader}>
                <h3 className={css.cardTitle}>{t('tokenBudgetTitle')}</h3>
                <p className={css.cardHint}>{t('tokenBudgetShareHint')}</p>
              </div>
              <div className={css.numberGrid}>
                <NumberField
                  label={t('tokenBudgetDailyTotal')}
                  hint={t('tokenBudgetDailyTotalUnit')}
                  value={state.tokenBudget.dailyTotal}
                  disabled={!state.writable || state.saving}
                  onChange={value => { props.setTokenBudget('dailyTotal', value) }}
                />
                <ShareField
                  label={t('tokenBudgetRegularShare')}
                  hint={t('tokenBudgetShareHint')}
                  value={state.tokenBudget.regularShare}
                  disabled={!state.writable || state.saving}
                  onChange={value => { props.setTokenBudget('regularShare', value) }}
                />
                <ShareField
                  label={t('tokenBudgetReviewShare')}
                  hint={t('tokenBudgetShareHint')}
                  value={state.tokenBudget.reviewShare}
                  disabled={!state.writable || state.saving}
                  onChange={value => { props.setTokenBudget('reviewShare', value) }}
                />
                <ShareField
                  label={t('tokenBudgetReserveShare')}
                  hint={t('tokenBudgetShareHint')}
                  value={state.tokenBudget.reserveShare}
                  disabled={!state.writable || state.saving}
                  onChange={value => { props.setTokenBudget('reserveShare', value) }}
                />
              </div>
              {state.sharesInvalid
                ? <p className={css.invalid}>{t('tokenBudgetShareInvalid')}</p>
                : null}
            </div>

            {state.conflicted
              ? <p className={css.conflict} role="status">{t('gatewayConflict')}</p>
              : null}
            {state.failed
              ? <p className={css.conflict} role="status">{t('saveFailed')}</p>
              : null}
            <div className={css.saveBar}>
              <span className={css.saveState}>
                {state.dirty ? t('unsavedHint') : ''}
              </span>
              <Button
                variant="primary"
                disabled={!state.dirty || state.invalid || state.saving}
                onClick={props.save}
              >
                {state.saving ? t('saving') : t('save')}
              </Button>
            </div>
          </div>
        )
        : <p className={css.unavailable}>{t('gatewayUnavailable')}</p>}
      {target?.kind === 'edit'
        ? <EditRouteModal
            index={target.index}
            state={state}
            t={t}
            actions={actions}
            onClose={closeEditor}
          />
        : null}
      {target?.kind === 'create'
        ? <CreateRouteModal
            zone={target.zone}
            state={state}
            t={t}
            onClose={closeEditor}
            onAdd={actions.onAdd}
          />
        : null}
    </section>
  )
}

/** Props for the three-zone routing board. */
interface RoutingBoardProps {
  state: ModelGatewayCardState
  t: Translate
  disabled: boolean
  onEdit: (index: number) => void
  onAdd: (zone: GatewayZone) => void
}

function RoutingBoard(props: RoutingBoardProps) {
  const { state, t, disabled, onEdit, onAdd } = props
  const boardId = useId()
  return (
    <div className={css.board}>
      {ZONE_OPTIONS.map(zone => {
        const rows = state.routing
          .map((route, index) => ({ route, index }))
          .filter(({ route }) => route.zone === zone.value)
        const headingId = `${boardId}-${zone.value}`
        return (
          <section key={zone.value} className={css.zoneColumn} aria-labelledby={headingId}>
            <header className={css.zoneHeader}>
              <h4 id={headingId} className={css.zoneTitle}>{t(zone.key)}</h4>
              <span className={css.zoneCount}>{rows.length}</span>
            </header>
            {rows.length > 0
              ? (
                <ul className={css.routeList}>
                  {rows.map(({ route, index }) => (
                    <RouteCard
                      key={index}
                      route={route}
                      t={t}
                      disabled={disabled}
                      onEdit={() => { onEdit(index) }}
                    />
                  ))}
                </ul>
              )
              : <p className={css.zoneEmpty}>{t('routingBoardEmpty')}</p>}
            <Tooltip label={t('routingAdd')} side="bottom">
              <button
                type="button"
                className={css.zoneAdd}
                disabled={disabled}
                onClick={() => { onAdd(zone.value) }}
                aria-label={t('routingAdd')}
              >
                <IconPlusOutlineRegular size={16} />
              </button>
            </Tooltip>
          </section>
        )
      })}
    </div>
  )
}

/** Props for one route card on the board. */
interface RouteCardProps {
  route: GatewayRouteEntry
  t: Translate
  disabled: boolean
  onEdit: () => void
}

function RouteCard(props: RouteCardProps) {
  const { route, t, disabled, onEdit } = props
  const categoryKey = CATEGORY_OPTIONS.find(opt => opt.value === route.category)?.key
  const tierKey = TIER_OPTIONS.find(opt => opt.value === route.tier)?.key
  return (
    <li>
      <Tooltip label={t('routingBoardHint')} side="bottom" delayMs={500}>
        <button
          type="button"
          className={css.routeCard}
          style={{ '--route-tier-color': TIER_COLOR[route.tier] } as React.CSSProperties}
          disabled={disabled}
          onClick={onEdit}
        >
          <span className={css.routeCategory}>{categoryKey !== undefined ? t(categoryKey) : route.category}</span>
          <span className={css.routeModel}>
            <span className={css.routeModelId}>{route.model}</span>
            <span className={css.routeProvider}>{route.provider}</span>
          </span>
          <Tag tone={TIER_TONE[route.tier]}>{tierKey !== undefined ? t(tierKey) : route.tier}</Tag>
        </button>
      </Tooltip>
    </li>
  )
}

/** Actions the route editor dispatches to the staged controller. */
interface RouteEditorActions {
  onProvider: (index: number, provider: string) => void
  onModel: (index: number, model: string) => void
  onZone: (index: number, zone: GatewayZone) => void
  onCategory: (index: number, category: GatewayCategory) => void
  onTier: (index: number, tier: GatewayTier) => void
  onRemove: (index: number) => void
  onAdd: (seed: { zone: GatewayZone, category: GatewayCategory, provider?: string, model?: string, tier?: GatewayTier }) => void
}

/** Props for the edit-route modal. */
interface EditRouteModalProps {
  index: number
  state: ModelGatewayCardState
  t: Translate
  actions: RouteEditorActions
  onClose: () => void
}

function EditRouteModal(props: EditRouteModalProps) {
  const { index, state, t, actions, onClose } = props
  const id = useId()
  const route = state.routing[index]
  if (route === undefined) return null
  const disabled = !state.writable || state.saving
  const modelOptions = state.catalogModels.get(route.provider)
    ?? [...new Set([...state.catalogModels.values()].flat())]
  return (
    <Modal
      open
      onClose={onClose}
      title={t('routeEditTitle')}
      closeLabel={t('close')}
      description={t('routeEditorHint')}
      footer={(
        <div className={css.modalFooter}>
          <button
            type="button"
            className={css.deleteButton}
            disabled={disabled}
            onClick={() => { actions.onRemove(index); onClose() }}
          >
            {t('routeDelete')}
          </button>
          <span className={css.modalFooterSpacer} />
          <Button variant="primary" onClick={onClose}>{t('done')}</Button>
        </div>
      )}
    >
      <div className={css.editorFields}>
        <SelectField
          id={`${id}-zone`}
          label={t('routingZone')}
          value={route.zone}
          disabled={disabled}
          options={ZONE_OPTIONS}
          t={t}
          onChange={value => { actions.onZone(index, value as GatewayZone) }}
        />
        <SelectField
          id={`${id}-category`}
          label={t('routingCategory')}
          value={route.category}
          disabled={disabled}
          options={CATEGORY_OPTIONS}
          t={t}
          onChange={value => { actions.onCategory(index, value as GatewayCategory) }}
        />
        <CatalogSelectField
          id={`${id}-provider`}
          label={t('routingProvider')}
          value={route.provider}
          disabled={disabled}
          options={state.catalogProviders}
          status={state.catalogStatus}
          t={t}
          onChange={value => { actions.onProvider(index, value) }}
        />
        <CatalogSelectField
          id={`${id}-model`}
          label={t('routingModel')}
          value={route.model}
          disabled={disabled}
          options={modelOptions}
          status={state.catalogStatus}
          t={t}
          onChange={value => { actions.onModel(index, value) }}
        />
        <SelectField
          id={`${id}-tier`}
          label={t('routingTier')}
          value={route.tier}
          disabled={disabled}
          options={TIER_OPTIONS}
          t={t}
          onChange={value => { actions.onTier(index, value as GatewayTier) }}
        />
      </div>
    </Modal>
  )
}

/** Props for the create-route modal. */
interface CreateRouteModalProps {
  zone: GatewayZone
  state: ModelGatewayCardState
  t: Translate
  onClose: () => void
  onAdd: (seed: { zone: GatewayZone, category: GatewayCategory, provider?: string, model?: string, tier?: GatewayTier }) => void
}

function CreateRouteModal(props: CreateRouteModalProps) {
  const { zone: initialZone, state, t, onClose, onAdd } = props
  const firstProvider = state.catalogProviders[0] ?? ''
  const firstModels = firstProvider === '' ? [] : state.catalogModels.get(firstProvider) ?? []
  const firstModel = firstModels[0] ?? ''
  const [zone, setZone] = useState<GatewayZone>(initialZone)
  const [category, setCategory] = useState<GatewayCategory>('simple')
  const [provider, setProvider] = useState<string>(firstProvider)
  const [model, setModel] = useState<string>(firstModel)
  const [tier, setTier] = useState<GatewayTier>('pool')
  const id = useId()
  const modelOptions = state.catalogModels.get(provider)
    ?? [...new Set([...state.catalogModels.values()].flat())]
  return (
    <Modal
      open
      onClose={onClose}
      title={t('routeAddTitle')}
      closeLabel={t('close')}
      description={t('routeEditorHint')}
      footer={(
        <div className={css.modalFooter}>
          <Button variant="ghost" onClick={onClose}>{t('close')}</Button>
          <Button variant="primary" onClick={() => { onAdd({ zone, category, provider, model, tier }); onClose() }}>
            {t('routeCreate')}
          </Button>
        </div>
      )}
    >
      <div className={css.editorFields}>
        <SelectField
          id={`${id}-zone`}
          label={t('routingZone')}
          value={zone}
          disabled={false}
          options={ZONE_OPTIONS}
          t={t}
          onChange={value => { setZone(value as GatewayZone) }}
        />
        <SelectField
          id={`${id}-category`}
          label={t('routingCategory')}
          value={category}
          disabled={false}
          options={CATEGORY_OPTIONS}
          t={t}
          onChange={value => { setCategory(value as GatewayCategory) }}
        />
        <CatalogSelectField
          id={`${id}-provider`}
          label={t('routingProvider')}
          value={provider}
          disabled={false}
          options={state.catalogProviders}
          status={state.catalogStatus}
          t={t}
          onChange={value => {
            setProvider(value)
            setModel(state.catalogModels.get(value)?.[0] ?? '')
          }}
        />
        <CatalogSelectField
          id={`${id}-model`}
          label={t('routingModel')}
          value={model}
          disabled={false}
          options={modelOptions}
          status={state.catalogStatus}
          t={t}
          onChange={setModel}
        />
        <SelectField
          id={`${id}-tier`}
          label={t('routingTier')}
          value={tier}
          disabled={false}
          options={TIER_OPTIONS}
          t={t}
          onChange={value => { setTier(value as GatewayTier) }}
        />
      </div>
    </Modal>
  )
}

/** Props for a catalog-backed provider/model `<select>` with a missing-value marker and status hint. */
interface CatalogSelectFieldProps {
  id: string
  label: string
  value: string
  disabled: boolean
  options: readonly string[]
  status: ModelGatewayCardState['catalogStatus']
  t: Translate
  onChange: (value: string) => void
}

function CatalogSelectField(props: CatalogSelectFieldProps) {
  const { id, label, value, disabled, options, status, t, onChange } = props
  const known = status === 'ready' ? options.filter(option => option.length > 0) : []
  const missing = status === 'ready' && value !== '' && !known.includes(value)
  const bareValue = value !== '' && !known.includes(value) && !missing
  return (
    <label className={css.fieldLabel} htmlFor={id}>
      <span className={css.fieldLabelText}>{label}</span>
      <select
        id={id}
        className={css.select}
        value={value}
        disabled={disabled}
        onChange={event => { onChange(event.target.value) }}
      >
        {known.map(option => (
          <option key={option} value={option}>{option}</option>
        ))}
        {missing
          ? <option value={value}>{value} · {t('catalogNotListed')}</option>
          : null}
        {bareValue
          ? <option value={value}>{value}</option>
          : null}
      </select>
      {status === 'loading'
        ? <span className={css.catalogHint}>{t('catalogLoading')}</span>
        : null}
      {status === 'error'
        ? <span className={css.catalogHint}>{t('catalogError')}</span>
        : null}
      {status === 'ready' && known.length === 0
        ? <span className={css.catalogHint}>{t('catalogEmpty')}</span>
        : null}
    </label>
  )
}

/** Props for a localized `<select>` field. */
interface SelectFieldProps {
  id: string
  label: string
  value: string
  disabled: boolean
  options: readonly { value: string, key: ModelGatewayLocaleKey }[]
  t: Translate
  onChange: (value: string) => void
}

function SelectField(props: SelectFieldProps) {
  const { id, label, value, disabled, options, t, onChange } = props
  return (
    <label className={css.fieldLabel} htmlFor={id}>
      <span className={css.fieldLabelText}>{label}</span>
      <select
        id={id}
        className={css.select}
        value={value}
        disabled={disabled}
        onChange={event => { onChange(event.target.value) }}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{t(opt.key)}</option>
        ))}
      </select>
    </label>
  )
}

/** Props for a whole-number field with an optional unit hint. */
interface NumberFieldProps {
  label: string
  hint: string
  value: number
  disabled: boolean
  onChange: (value: number) => void
}

function NumberField(props: NumberFieldProps) {
  return (
    <label className={css.fieldLabel}>
      <span className={css.fieldLabelText}>{props.label}</span>
      <span className={css.fieldInputRow}>
        <input
          className={css.numberInput}
          type="number"
          min={0}
          step={1}
          value={props.value}
          disabled={props.disabled}
          onChange={event => {
            const parsed = Number.parseInt(event.target.value, 10)
            if (Number.isSafeInteger(parsed) && parsed >= 0) props.onChange(parsed)
          }}
        />
        <span className={css.fieldUnit}>{props.hint}</span>
      </span>
    </label>
  )
}

/** Props for a fractional share field with a hint. */
interface ShareFieldProps {
  label: string
  hint: string
  value: number
  disabled: boolean
  onChange: (value: number) => void
}

function ShareField(props: ShareFieldProps) {
  return (
    <label className={css.fieldLabel}>
      <span className={css.fieldLabelText}>{props.label}</span>
      <span className={css.fieldInputRow}>
        <input
          className={css.numberInput}
          type="number"
          min={0}
          max={1}
          step={0.01}
          value={props.value}
          disabled={props.disabled}
          onChange={event => {
            const parsed = Number.parseFloat(event.target.value)
            if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 1) props.onChange(parsed)
          }}
        />
        <span className={css.fieldUnit}>{props.hint}</span>
      </span>
    </label>
  )
}
