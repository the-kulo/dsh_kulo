/** Settings section composing the subagent model pool outside the Plugins page. */

import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { SettingsForm } from '@deepseek-ai/dsh-client-ui-primitives'
import { formLabels } from './locales.ts'
import { SubagentModelSelectionFields } from './SubagentModelSelectionFields.tsx'
import type { SubagentModelSelectionCardFace, SubagentModelSelectionCardState } from './subagent-model-selection-card-controller.ts'
import css from './ModelPoolSection.module.css'

/** Registration-side face for the standalone Model Pool settings section. */
export type ModelPoolSectionFace = Pick<SubagentModelSelectionCardFace,
  'hooks' | 'toggleEnabled' | 'toggleModel' | 'retryCatalog'
  | 'toggleAutoSelect' | 'toggleAutoSelectable' | 'setCapabilityTags' | 'save' | 'discard'>

/** Framework-derived props for the standalone Model Pool settings section. */
export type ModelPoolSectionProps = PropsRuntime<'settings.section'>
  & PropsLocale<'settings.subagent'> & InjectFace<ModelPoolSectionFace>

/**
 * Derive the section's form shell from the model-selection card alone; the
 * delegation limits stay on the Plugins page.
 * @param state - Current model-authorization card snapshot.
 * @returns Availability and settlement for the shared SettingsForm footer.
 */
export function modelPoolSectionShell(state: SubagentModelSelectionCardState) {
  return {
    available: state.available,
    writable: state.writable,
    dirty: state.dirty,
    invalid: state.invalid || (state.dirty && state.conflicted),
    saving: state.saving,
    failed: state.failed,
  }
}

/**
 * Render the subagent model pool with one save footer; content scrolls inside
 * the shared form surface.
 * @param props - Locale, the models form snapshot, and its actions.
 * @returns The model-pool settings form.
 */
export function ModelPoolSection(props: ModelPoolSectionProps) {
  const { t } = props
  const models = props.useSubagentModelSelectionCard(snapshot => snapshot)
  const state = modelPoolSectionShell(models)
  return (
    <section className={css.section}>
      <h2 className={css.title}>{t('modelPoolTitle')}</h2>
      <p className={css.description}>{t('modelPoolDescription')}</p>
      {models.available
        ? (
          <SettingsForm labels={formLabels(t)} state={state} onSave={props.save} onDiscard={props.discard}>
            <SubagentModelSelectionFields t={t} state={{ ...models, saving: state.saving }}
              toggleEnabled={props.toggleEnabled} toggleModel={props.toggleModel} retryCatalog={props.retryCatalog}
              toggleAutoSelect={props.toggleAutoSelect} toggleAutoSelectable={props.toggleAutoSelectable}
              setCapabilityTags={props.setCapabilityTags} />
          </SettingsForm>
        )
        : <p className={css.unavailable}>{t('modelPoolUnavailable')}</p>}
    </section>
  )
}
