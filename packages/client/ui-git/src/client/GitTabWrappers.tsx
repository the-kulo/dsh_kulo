/**
 * Thin wrappers connecting slot framework props to the git panel components.
 * Lives in a .tsx file because the slot-registered components contain JSX.
 *
 * Registered into `sidebar.right.pane.tab` and `sidebar.right.pane.tab.title`
 * keyed `@deepseek-ai/dsh-client-ui-git`.
 */
import type { ReactNode } from 'react'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import { IconBranchOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { IGitPanel } from '@deepseek-ai/dsh-api-git-controller/client'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from './locales.ts'
import { GitPanelBody } from './git-panel/GitPanel.tsx'

/** Props the git tab body reads from the slot framework. */
type GitTabBodyProps = PropsRuntime<'sidebar.right.pane.tab'> & PropsLocale<'gitPanel'>

/**
 * Create a body component that already carries the gitPanel service.
 * @param gitPanel - the Client git panel service the tab renders.
 * @returns the slot-registered body component.
 */
export function createGitTabBody(gitPanel: IGitPanel): (props: GitTabBodyProps) => ReactNode {
  return function GitTabBody(props: GitTabBodyProps): ReactNode {
    const { sessionId, useWorkspaces, t } = props
    const workspaceId = useWorkspaces(ws => ws.items.find(w => w.sessionIds.includes(sessionId))?.workspaceId)
    return <GitPanelBody gitPanel={gitPanel} workspaceId={workspaceId} t={t} />
  }
}

/** The chip title: branch icon before the tab's title text. */
export function GitTabTitle({ useTabInfo }: PropsRuntime<'sidebar.right.pane.tab.title'>): ReactNode {
  const { tab } = useTabInfo()
  return (
    <>
      <IconBranchOutlineRegular size={16} />
      {tab.title}
    </>
  )
}
