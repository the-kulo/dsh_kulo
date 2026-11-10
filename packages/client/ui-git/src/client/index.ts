/**
 * Browser half: register `git` as a right-Sidebar tab type.
 *
 * The public two-stage path: the type into `ctx.sidebarRightTabs`,
 * the body into the keyed `sidebar.right.pane.tab` seat and the chip title into
 * the keyed `sidebar.right.pane.tab.title` seat, both under the type's `id`.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-git-controller/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-api-workspace-controller/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type { SidebarRightTabDefinition } from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type { TranslateNS } from '@deepseek-ai/dsh-client-locale/client'
import { IconBranchOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type {} from './locales.ts'
import type { GitSettingsKey } from './settings/locales.ts'
import { GitSection } from './settings/GitSection.tsx'
import type { GitSectionInjected } from './settings/GitSection.tsx'
import { en as settingsEn, zh as settingsZh } from './settings/locales.ts'
import { createGitTabBody, GitTabTitle } from './GitTabWrappers.tsx'
import { en, zh } from './locales.ts'

export type { GitKey } from './locales.ts'
export type { GitSectionInjected, GitSectionProps } from './settings/GitSection.tsx'
export type { GitSettingsKey } from './settings/locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Git binding settings-section copy. */
    'settings.git': GitSettingsKey
  }
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    /** Git panel extra actions after the header controls. */
    'sidebar.right.tab.git.actions': {
      kind: 'list'
      scope: 'session'
      owner: object
    }
  }
}

/** This package's copy namespace. */
const NS = 'gitPanel'

/** The settings-section copy namespace. */
const SETTINGS_NS = 'settings.git'

/** The tab kind this package owns. */
const GIT_KIND = 'git'

/** This implementation's identity in the tab system. */
const GIT_ID = '@deepseek-ai/dsh-client-ui-git'

/**
 * Required browser services: the tab registry, the keyed seat, locale,
 * the git panel service, and the workspace list the settings section binds from.
 */
export const inject = ['slots', 'locale', 'sidebarRightTabs', 'sidebarRight', 'gitPanel', 'workspaces']

/**
 * The git type's registry definition.
 * @param t - namespace-bound translate, read fresh on every label call.
 * @returns the definition to register.
 */
function gitDefinition(t: TranslateNS<'gitPanel'>): SidebarRightTabDefinition {
  return {
    id: GIT_ID,
    kind: GIT_KIND,
    priority: 'builtin',
    title: () => t('panel.title'),
    guide: [{
      id: 'git',
      order: 20,
      title: () => t('guide.title'),
      description: () => t('guide.description'),
      icon: IconBranchOutlineRegular,
    }],
  }
}

/**
 * Client plugin body: register the type, its dictionaries, its body, and its chip title.
 * @param ctx - client root context carrying the registry, the slots, and the git panel service.
 */
export function apply(ctx: ClientContext): void {
  const t = ctx.locale.bind(NS)
  ctx.effect(() => ctx.sidebarRightTabs.register(gitDefinition(t)), 'ui-git: git type')
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-git: dictionaries')
  // Close over gitPanel and pass it to the body through a factory; the tab needs
  // an inject factory even when it adds no per-session members.
  const GitTabBody = createGitTabBody(ctx.gitPanel)
  ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register(
    { name: 'sidebar.right.pane.tab', key: GIT_ID, locale: NS },
    GitTabBody,
  )), 'ui-git: git tab body')
  ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab.title', () => ctx.slots.register(
    { name: 'sidebar.right.pane.tab.title', key: GIT_ID },
    GitTabTitle,
  )), 'ui-git: git tab title')

  // The binding form lives in Settings; it needs the same dictionaries and the
  // git panel service, so it registers from this plugin's fiber.
  const tSettings = ctx.locale.bind(SETTINGS_NS)
  ctx.effect(() => ctx.locale.register(SETTINGS_NS, {
    zh: settingsZh, en: settingsEn,
  }), 'ui-git: git settings dictionaries')

  const gitSectionInjected = (): GitSectionInjected => ({
    hooks: {
      gitPanel: {
        getSnapshot: () => ctx.gitPanel.read(),
        subscribe: listener => ctx.gitPanel.subscribe(listener),
      },
      workspaces: ctx.workspaces.list,
    },
    bind: async (workspaceId, input) => {
      await ctx.gitPanel.follow(workspaceId)
      await ctx.gitPanel.bind(input)
    },
    unbind: async (workspaceId) => {
      await ctx.gitPanel.follow(workspaceId)
      await ctx.gitPanel.unbind()
    },
    follow: async (workspaceId) => {
      await ctx.gitPanel.follow(workspaceId)
    },
    promote: async () => {
      await ctx.gitPanel.promote()
    },
    checkoutBranch: async (_workspaceId, branch) => {
      await ctx.gitPanel.checkoutBranch(branch)
    },
  })

  ctx.effect(() => ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'git',
    order: 30,
    label: () => tSettings('nav'),
    locale: SETTINGS_NS,
    inject: gitSectionInjected,
  }, GitSection)), 'ui-git: git settings section')
}
