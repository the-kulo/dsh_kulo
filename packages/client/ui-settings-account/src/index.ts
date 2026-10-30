/** Host configuration for the account settings client. */
import type {} from '@deepseek-ai/dsh-settings'
import type { Context, Volatile } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { OnboardingSettingsFields, type OnboardingStep, type OnboardingPurpose, type OnboardingProcess } from './onboarding-settings.ts'
/** Public live device-local onboarding progress. */
export interface Config {
  /** Onboarding progress format version. */
  version: Volatile<1>
  /** Last accepted onboarding page. */
  step: Volatile<OnboardingStep>
  /** Selected work scenario. */
  purpose?: Volatile<OnboardingPurpose | null | undefined>
  /** Selected transcript detail. */
  process?: Volatile<OnboardingProcess | null | undefined>
  /** Completion reason, absent until completion. */
  completion?: Volatile<'completed' | 'skipped' | 'api-key' | null | undefined>
  /** Selected usage detail. */
  usage: Volatile<'compact' | 'detailed'>
  /** Selected developer-tool visibility. */
  developerTools: Volatile<boolean>
}

/** Configuration projected through the account plugin's shared form. */
export const Config = z.object({
  version: OnboardingSettingsFields.version.volatile(),
  step: OnboardingSettingsFields.step.volatile(),
  purpose: OnboardingSettingsFields.purpose.volatile(),
  process: OnboardingSettingsFields.process.volatile(),
  completion: OnboardingSettingsFields.completion.volatile(),
  usage: OnboardingSettingsFields.usage.volatile(),
  developerTools: OnboardingSettingsFields.developerTools.volatile(),
})

/**
 * The account plugin keeps no host-plane state; onboarding progress persists
 * through the settings service the client half configures.
 * @param ctx - Host context.
 */
export function apply(ctx: Context): void {
  ctx.inject(['settings'], (scope) => {
    scope.effect(() => scope.settings.configure({ auto: false }, ctx.fiber))
  })
}
