/** Settings section for the model gateway routing, expert quota, and token budget. */

import { useId } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { Switch } from '@deepseek-ai/dsh-client-ui-primitives'
import type {
  GatewayCategory, GatewayRouteEntry, GatewayTier, GatewayZone,
  ModelGatewayCardFace, ModelGatewayCardState,
} from './model-gateway-card-controller.ts'
import {
  CATEGORY_OPTIONS, TIER_OPTIONS, ZONE_OPTIONS,
} from './model-gateway-card-controller.ts'
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

/**
 * Render the model gateway settings form with routing table, expert quota, and token budget.
 * @param props - Locale, the gateway form snapshot, and its actions.
 * @returns the model-gateway settings form.
 */
export function ModelGatewaySection(props: ModelGatewaySectionProps) {
  const { t } = props
  const state = props.useModelGatewayCard(snapshot => snapshot)
  return (
    <section className={css.section}>
      <h2 className={css.title}>{t('gatewayTitle')}</h2>
      <p className={css.description}>{t('gatewayDescription')}</p>
      {state.available
        ? (
          <div className={css.body}>
            <div className={css.toggleRow}>
              <span className={css.toggleLabel}>{t('gatewayEnabled')}</span>
              <Switch
                checked={state.enabled}
                label={t('gatewayEnabled')}
                disabled={!state.writable || state.saving}
                onChange={props.toggleEnabled}
              />
            </div>
            <p className={css.hint}>{t('gatewayEnabledHint')}</p>

            <h3 className={css.subtitle}>{t('routingTitle')}</h3>
            <p className={css.hint}>{t('routingDescription')}</p>
            <div className={css.routingScroll}>
              <table className={css.routingTable}>
                <thead>
                  <tr>
                    <th>{t('routingZone')}</th>
                    <th>{t('routingCategory')}</th>
                    <th>{t('routingProvider')}</th>
                    <th>{t('routingModel')}</th>
                    <th>{t('routingTier')}</th>
                    <th aria-label={t('routingRemove')} />
                  </tr>
                </thead>
                <tbody>
                  {state.routing.map((route, index) => (
                    <RouteRow
                      key={index}
                      index={index}
                      route={route}
                      state={state}
                      t={t}
                      onProvider={props.setRouteProvider}
                      onModel={props.setRouteModel}
                      onZone={props.setRouteZone}
                      onCategory={props.setRouteCategory}
                      onTier={props.setRouteTier}
                      onRemove={props.removeRoute}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              className={css.addButton}
              disabled={!state.writable || state.saving}
              onClick={props.addRoute}
            >
              {t('routingAdd')}
            </button>

            <h3 className={css.subtitle}>{t('expertQuotaTitle')}</h3>
            <div className={css.numberGrid}>
              <NumberField
                label={t('expertQuotaDailyCallLimit')}
                value={state.expertQuota.dailyCallLimit}
                disabled={!state.writable || state.saving}
                onChange={value => { props.setExpertQuota('dailyCallLimit', value) }}
              />
              <NumberField
                label={t('expertQuotaMaxEscalations')}
                value={state.expertQuota.maxEscalationsPerTask}
                disabled={!state.writable || state.saving}
                onChange={value => { props.setExpertQuota('maxEscalationsPerTask', value) }}
              />
              <NumberField
                label={t('expertQuotaContextBudget')}
                value={state.expertQuota.contextBudgetTokens}
                disabled={!state.writable || state.saving}
                onChange={value => { props.setExpertQuota('contextBudgetTokens', value) }}
              />
            </div>

            <h3 className={css.subtitle}>{t('tokenBudgetTitle')}</h3>
            <div className={css.numberGrid}>
              <NumberField
                label={t('tokenBudgetDailyTotal')}
                value={state.tokenBudget.dailyTotal}
                disabled={!state.writable || state.saving}
                onChange={value => { props.setTokenBudget('dailyTotal', value) }}
              />
              <ShareField
                label={t('tokenBudgetRegularShare')}
                value={state.tokenBudget.regularShare}
                disabled={!state.writable || state.saving}
                onChange={value => { props.setTokenBudget('regularShare', value) }}
              />
              <ShareField
                label={t('tokenBudgetReviewShare')}
                value={state.tokenBudget.reviewShare}
                disabled={!state.writable || state.saving}
                onChange={value => { props.setTokenBudget('reviewShare', value) }}
              />
              <ShareField
                label={t('tokenBudgetReserveShare')}
                value={state.tokenBudget.reserveShare}
                disabled={!state.writable || state.saving}
                onChange={value => { props.setTokenBudget('reserveShare', value) }}
              />
            </div>
            {state.sharesInvalid
              ? <p className={css.invalid}>{t('tokenBudgetShareInvalid')}</p>
              : null}
            {state.conflicted
              ? <p className={css.conflict} role="status">{t('gatewayConflict')}</p>
              : null}
            <div className={css.footer}>
              {state.failed ? <p className={css.conflict} role="status">{t('saveFailed')}</p> : null}
              <button
                type="button"
                className={css.saveButton}
                disabled={!state.dirty || state.invalid || state.saving}
                onClick={props.save}
              >
                {state.saving ? t('saving') : t('save')}
              </button>
            </div>
          </div>
        )
        : <p className={css.unavailable}>{t('gatewayUnavailable')}</p>}
    </section>
  )
}

/** Props for one routing table row. */
interface RouteRowProps {
  index: number
  route: GatewayRouteEntry
  state: ModelGatewayCardState
  t: (key: import('./locales.ts').ModelGatewayLocaleKey) => string
  onProvider: (index: number, provider: string) => void
  onModel: (index: number, model: string) => void
  onZone: (index: number, zone: GatewayZone) => void
  onCategory: (index: number, category: GatewayCategory) => void
  onTier: (index: number, tier: GatewayTier) => void
  onRemove: (index: number) => void
}

function RouteRow(props: RouteRowProps) {
  const { index, route, state, t } = props
  const providerListId = useId()
  const modelListId = useId()
  const modelOptions = state.catalogModels.get(route.provider)
    ?? [...new Set([...state.catalogModels.values()].flat())]
  return (
    <tr>
      <td>
        <select
          className={css.select}
          value={route.zone}
          disabled={!state.writable || state.saving}
          onChange={event => { props.onZone(index, event.target.value as GatewayZone) }}
        >
          {ZONE_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{t(opt.key)}</option>
          ))}
        </select>
      </td>
      <td>
        <select
          className={css.select}
          value={route.category}
          disabled={!state.writable || state.saving}
          onChange={event => { props.onCategory(index, event.target.value as GatewayCategory) }}
        >
          {CATEGORY_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{t(opt.key)}</option>
          ))}
        </select>
      </td>
      <td>
        <input
          className={css.textInput}
          type="text"
          list={providerListId}
          value={route.provider}
          disabled={!state.writable || state.saving}
          onChange={event => { props.onProvider(index, event.target.value) }}
        />
        <datalist id={providerListId}>
          {state.catalogProviders.map(provider => (
            <option key={provider} value={provider} />
          ))}
        </datalist>
      </td>
      <td>
        <input
          className={css.textInput}
          type="text"
          list={modelListId}
          value={route.model}
          disabled={!state.writable || state.saving}
          onChange={event => { props.onModel(index, event.target.value) }}
        />
        <datalist id={modelListId}>
          {modelOptions.map(model => (
            <option key={model} value={model} />
          ))}
        </datalist>
      </td>
      <td>
        <select
          className={css.select}
          value={route.tier}
          disabled={!state.writable || state.saving}
          onChange={event => { props.onTier(index, event.target.value as GatewayTier) }}
        >
          {TIER_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{t(opt.key)}</option>
          ))}
        </select>
      </td>
      <td>
        <button
          type="button"
          className={css.removeButton}
          disabled={!state.writable || state.saving}
          onClick={() => { props.onRemove(index) }}
        >
          {t('routingRemove')}
        </button>
      </td>
    </tr>
  )
}

/** Props for a whole-number field. */
interface NumberFieldProps {
  label: string
  value: number
  disabled: boolean
  onChange: (value: number) => void
}

function NumberField(props: NumberFieldProps) {
  return (
    <label className={css.fieldLabel}>
      <span className={css.fieldLabelText}>{props.label}</span>
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
    </label>
  )
}

/** Props for a fractional share field. */
interface ShareFieldProps {
  label: string
  value: number
  disabled: boolean
  onChange: (value: number) => void
}

function ShareField(props: ShareFieldProps) {
  return (
    <label className={css.fieldLabel}>
      <span className={css.fieldLabelText}>{props.label}</span>
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
    </label>
  )
}
