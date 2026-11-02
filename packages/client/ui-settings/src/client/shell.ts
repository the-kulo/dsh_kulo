/** Settings shell navigation shared across features without a shell import. */

/**
 * Actions the settings shell exposes to sibling features that need to open a
 * settings onboarding step without importing the shell.
 */
export interface SettingsShell {
  /**
   * Open one registered settings onboarding step explicitly, closing the
   * settings panel if it is open.
   * @param id - onboarding step id (for example 'deepseek-official').
   */
  openOnboarding: (id: string) => void
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Settings shell navigation shared across features. */
    settingsShell: SettingsShell
  }
}
