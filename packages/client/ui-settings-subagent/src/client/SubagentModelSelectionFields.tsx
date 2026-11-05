/** User control for model-selectable subagent delegation in new sessions. */

import { Switch } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type {
  SubagentModelCandidate,
  SubagentModelSelectionCardFace,
  SubagentModelSelectionCardState,
} from './subagent-model-selection-card-controller.ts'
import css from './SubagentModelSelectionFields.module.css'

/** Plain model state and callbacks supplied by the owning Subagent card. */
export type SubagentModelSelectionFieldsProps = PropsLocale<'settings.subagent'>
  & Pick<SubagentModelSelectionCardFace,
    'toggleEnabled' | 'toggleModel' | 'retryCatalog' | 'toggleAutoSelect' | 'toggleAutoSelectable'
    | 'setCapabilityTags' | 'setCapabilityPriority' | 'setCapabilityCost' | 'setCapabilitySpeed'>
  & { state: SubagentModelSelectionCardState }

/** One line of the read-only automatic-routing rule summary. */
function RoutingRule(props: { label: string; rule: string }) {
  return (
    <div className={css.ruleRow}>
      <span className={css.ruleCategory}>{props.label}</span>
      <span className={css.ruleText}>{props.rule}</span>
    </div>
  )
}

/**
 * Render the default-off preference and its exact adapter-route choices.
 * @param props - locale copy, the card snapshot, and its staged actions.
 * @returns the model permission and route choices inside the shared card.
 */
export function SubagentModelSelectionFields(props: SubagentModelSelectionFieldsProps) {
  const { t, state } = props
  const availableGroups = new Map<string, {
    providerName: string
    candidates: SubagentModelCandidate[]
  }>()
  const unavailable: SubagentModelCandidate[] = []
  for (const candidate of state.candidates) {
    if (!candidate.available) {
      unavailable.push(candidate)
      continue
    }
    const group = availableGroups.get(candidate.provider)
    if (group === undefined) {
      availableGroups.set(candidate.provider, {
        providerName: candidate.providerName,
        candidates: [candidate],
      })
    } else {
      group.candidates.push(candidate)
    }
  }
  const renderCandidate = (candidate: SubagentModelCandidate) => {
    const usage = state.usage === undefined ? undefined : state.usage?.get(candidate.key)
    return (
      <div key={candidate.key} className={css.modelEntry}>
        <label className={css.model}>
          <input
            type="checkbox"
            checked={candidate.selected}
            disabled={!state.writable || state.saving}
            onChange={() => { props.toggleModel(candidate.key) }}
          />
          <span>
            <span className={css.modelName}>{candidate.modelName}</span>
            <span className={css.route}>{`${candidate.providerName} · ${candidate.provider}/${candidate.model}`}</span>
          </span>
          {!candidate.available
            ? <span className={css.unavailable}>{t('subagentModelSelectionUnavailable')}</span>
            : null}
        </label>
        {candidate.selected && state.autoSelect
          ? (
            <div className={css.capability}>
              <label className={css.capabilityToggle}>
                <input
                  type="checkbox"
                  aria-label={`${candidate.provider}/${candidate.model} ${t('subagentModelSelectionCapabilityAutoSelectable')}`}
                  checked={candidate.capability?.autoSelectable ?? false}
                  disabled={!state.writable || state.saving}
                  onChange={() => { props.toggleAutoSelectable(candidate.key) }}
                />
                <span>{t('subagentModelSelectionCapabilityAutoSelectable')}</span>
              </label>
              <div className={css.capabilityFields}>
                <label className={css.capabilityField}>
                  <span className={css.capabilityLabel}>{t('subagentModelSelectionCapabilityTags')}</span>
                  <input
                    className={css.capabilityTags}
                    type="text"
                    aria-label={`${candidate.provider}/${candidate.model} ${t('subagentModelSelectionCapabilityTags')}`}
                    placeholder={t('subagentModelSelectionCapabilityTagsHint')}
                    value={candidate.capability?.tags.join(', ') ?? ''}
                    disabled={!state.writable || state.saving}
                    onChange={(event) => { props.setCapabilityTags(candidate.key, event.target.value) }}
                  />
                  <span className={css.hint}>{t('subagentModelSelectionCapabilityTagsValues')}</span>
                </label>
                <label className={css.capabilityField}>
                  <span className={css.capabilityLabel}>{t('subagentModelSelectionCapabilityPriority')}</span>
                  <input
                    className={css.capabilityNumber}
                    type="number"
                    step={1}
                    aria-label={`${candidate.provider}/${candidate.model} ${t('subagentModelSelectionCapabilityPriority')}`}
                    value={candidate.capability?.priority ?? 0}
                    disabled={!state.writable || state.saving}
                    onChange={(event) => { props.setCapabilityPriority(candidate.key, event.target.value) }}
                  />
                  <span className={css.hint}>{t('subagentModelSelectionCapabilityPriorityHint')}</span>
                </label>
                <label className={css.capabilityField}>
                  <span className={css.capabilityLabel}>{t('subagentModelSelectionCapabilityCost')}</span>
                  <select
                    className={css.capabilitySelect}
                    aria-label={`${candidate.provider}/${candidate.model} ${t('subagentModelSelectionCapabilityCost')}`}
                    value={candidate.capability?.cost ?? ''}
                    disabled={!state.writable || state.saving}
                    onChange={(event) => { props.setCapabilityCost(candidate.key, event.target.value) }}
                  >
                    <option value="">{t('subagentModelSelectionCapabilityTierUndeclared')}</option>
                    <option value="free">{t('subagentModelSelectionCapabilityCostFree')}</option>
                    <option value="low">{t('subagentModelSelectionCapabilityCostLow')}</option>
                    <option value="standard">{t('subagentModelSelectionCapabilityCostStandard')}</option>
                    <option value="high">{t('subagentModelSelectionCapabilityCostHigh')}</option>
                  </select>
                </label>
                <label className={css.capabilityField}>
                  <span className={css.capabilityLabel}>{t('subagentModelSelectionCapabilitySpeed')}</span>
                  <select
                    className={css.capabilitySelect}
                    aria-label={`${candidate.provider}/${candidate.model} ${t('subagentModelSelectionCapabilitySpeed')}`}
                    value={candidate.capability?.speed ?? ''}
                    disabled={!state.writable || state.saving}
                    onChange={(event) => { props.setCapabilitySpeed(candidate.key, event.target.value) }}
                  >
                    <option value="">{t('subagentModelSelectionCapabilityTierUndeclared')}</option>
                    <option value="fast">{t('subagentModelSelectionCapabilitySpeedFast')}</option>
                    <option value="balanced">{t('subagentModelSelectionCapabilitySpeedBalanced')}</option>
                    <option value="slow">{t('subagentModelSelectionCapabilitySpeedSlow')}</option>
                  </select>
                </label>
                {state.usage !== undefined
                  ? (
                    <div className={css.usageRow}>
                      <span className={css.capabilityLabel}>{t('subagentModelSelectionUsage')}</span>
                      <span className={css.usageValue}>
                        {usage === undefined || usage === null
                          ? t('subagentModelSelectionUsageUnavailable')
                          : t('subagentModelSelectionUsageValue', {
                            requests: usage.requests,
                            tokens: usage.totalTokens,
                          })}
                      </span>
                    </div>
                  )
                  : null}
              </div>
            </div>
          )
          : null}
      </div>
    )
  }
  return (
    <>
      <div className={css.permission}>
        <div className={css.toggleRow}>
          <span className={css.toggleLabel}>{t('subagentModelSelectionToggle')}</span>
          <Switch
            checked={state.enabled}
            label={t('subagentModelSelectionToggle')}
            disabled={!state.writable || state.saving}
            onChange={props.toggleEnabled}
          />
        </div>
        <p className={css.hint}>
          {t(state.enabled ? 'subagentModelSelectionChoose' : 'subagentModelSelectionOff')}
        </p>
        {state.enabled
          ? (
            <>
              <div className={css.toggleRow}>
                <span className={css.toggleLabel}>{t('subagentModelSelectionAutoSelect')}</span>
                <Switch
                  checked={state.autoSelect}
                  label={t('subagentModelSelectionAutoSelect')}
                  disabled={!state.writable || state.saving}
                  onChange={props.toggleAutoSelect}
                />
              </div>
              <p className={css.hint}>{t('subagentModelSelectionAutoSelectHint')}</p>
            </>
          )
          : null}
      </div>
      {state.enabled
        ? (
          <div className={css.selection}>
            {state.catalogStatus === 'loading'
              ? <p className={css.notice} role="status">{t('subagentModelSelectionLoading')}</p>
              : null}
            {state.catalogStatus === 'error'
              ? (
                <div className={css.catalogError} role="alert">
                  <span>{t('subagentModelSelectionLoadFailed')}</span>
                  <button type="button" disabled={state.saving} onClick={props.retryCatalog}>
                    {t('subagentModelSelectionRetry')}
                  </button>
                </div>
              )
              : null}
            {state.catalogPartial
              ? <p className={css.notice}>{t('subagentModelSelectionPartial')}</p>
              : null}
            {state.candidates.length > 0
              ? (
                <fieldset className={css.models}>
                  <legend>{t('subagentModelSelectionAllowed')}</legend>
                  {[...availableGroups].map(([provider, group]) => (
                    <div key={provider} className={css.modelGroup}>
                      <div className={css.providerName}>{group.providerName}</div>
                      {group.candidates.map(renderCandidate)}
                    </div>
                  ))}
                  {unavailable.length > 0
                    ? (
                      <div className={css.modelGroup}>
                        <div className={css.providerName}>{t('subagentModelSelectionUnavailableGroup')}</div>
                        {unavailable.map(renderCandidate)}
                      </div>
                    )
                    : null}
                </fieldset>
              )
              : state.catalogStatus === 'ready'
                ? <p className={css.notice}>{t('subagentModelSelectionEmpty')}</p>
                : null}
            {state.invalid ? <p className={css.invalid}>{t('subagentModelSelectionRequired')}</p> : null}
            {state.autoSelect
              ? (
                <div className={css.rules}>
                  <div className={css.rulesTitle}>{t('subagentModelSelectionRoutingRules')}</div>
                  <RoutingRule
                    label={t('subagentModelSelectionRuleSensitive')}
                    rule={t('subagentModelSelectionRuleSensitiveText')}
                  />
                  <RoutingRule
                    label={t('subagentModelSelectionRuleCode')}
                    rule={t('subagentModelSelectionRuleCodeText')}
                  />
                  <RoutingRule
                    label={t('subagentModelSelectionRuleReasoning')}
                    rule={t('subagentModelSelectionRuleReasoningText')}
                  />
                  <RoutingRule
                    label={t('subagentModelSelectionRuleSimple')}
                    rule={t('subagentModelSelectionRuleSimpleText')}
                  />
                  <p className={css.hint}>{t('subagentModelSelectionRoutingSort')}</p>
                </div>
              )
              : null}
          </div>
        )
        : null}
      {state.conflicted
        ? <p className={css.conflict} role="status">{t('subagentModelSelectionConflict')}</p>
        : null}
    </>
  )
}
