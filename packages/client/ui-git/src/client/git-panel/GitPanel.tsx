/**
 * The git panel's body: binding form when unbound, changed-files tree and
 * commit list when bound, error fallback when the controller is in error state.
 */
import { type KeyboardEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import clsx from 'clsx'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { IGitPanel, GitPanelView } from '@deepseek-ai/dsh-api-git-controller/client'
import type { GitFileState } from '@deepseek-ai/dsh-api-git-controller/types'
import {
  IconBranchOutlineRegular, IconRefreshOutlineRegular,
  IconChevronRightOutlineRegular, IconChevronDownOutlineRegular,
  Tooltip,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { WorkspaceId } from '@deepseek-ai/dsh-api-workspace-controller/types'
import type {} from '../locales.ts'
import { buildGitTree, type GitTreeNode } from './tree.ts'
import css from './GitPanel.module.css'

/** Props the body receives: the git panel controller handle, locale binding, and workspace resolution. */
export interface GitPanelBodyProps {
  readonly gitPanel: IGitPanel
  readonly workspaceId: WorkspaceId | undefined
  readonly t: TranslateNS<'gitPanel'>
}

/** Single-letter badge for a file state. */
function stateLetter(state: GitFileState): string {
  switch (state) {
    case 'added': return 'A'
    case 'modified': return 'M'
    case 'deleted': return 'D'
    case 'renamed': return 'R'
    case 'untracked': return '?'
    case 'conflicted': return '!'
  }
}

/** Row styles per file state. */
function stateClass(state: GitFileState): string | undefined {
  switch (state) {
    case 'added': return css.stateAdded
    case 'modified': return css.stateModified
    case 'deleted': return css.stateDeleted
    case 'renamed': return css.stateRenamed
    case 'untracked': return css.stateUntracked
    case 'conflicted': return css.stateConflicted
  }
}

/** Human-readable label for a state badge. */
function stateLabel(t: TranslateNS<'gitPanel'>, state: GitFileState): string {
  switch (state) {
    case 'added': return t('state.added')
    case 'modified': return t('state.modified')
    case 'deleted': return t('state.deleted')
    case 'renamed': return t('state.renamed')
    case 'untracked': return t('state.untracked')
    case 'conflicted': return t('state.conflicted')
  }
}

/** Render a relative timestamp. */
function relativeTime(t: TranslateNS<'gitPanel'>, iso: string): string {
  const then = Date.parse(iso)
  if (Number.isNaN(then)) return iso
  const diff = Date.now() - then
  const secs = Math.floor(diff / 1000)
  if (secs < 60) return t('time.secondsAgo', { value: secs })
  const mins = Math.floor(secs / 60)
  if (mins < 60) return t('time.minutesAgo', { value: mins })
  const hours = Math.floor(mins / 60)
  if (hours < 24) return t('time.hoursAgo', { value: hours })
  const days = Math.floor(hours / 24)
  if (days < 30) return t('time.daysAgo', { value: days })
  return iso.slice(0, 10)
}

/** Visible rows in focus order plus every visible node indexed by path. */
interface VisibleTree {
  readonly visiblePaths: readonly string[]
  readonly nodeByPath: ReadonlyMap<string, GitTreeNode>
}

/**
 * Flatten the tree to the currently visible rows and index each visible node.
 * @param tree - the derived git tree.
 * @param expanded - the set of expanded directory paths.
 * @returns visible row paths in focus order and a path-to-node index.
 */
function flattenVisible(tree: readonly GitTreeNode[], expanded: ReadonlySet<string>): VisibleTree {
  const visiblePaths: string[] = []
  const nodeByPath = new Map<string, GitTreeNode>()
  const walk = (nodes: readonly GitTreeNode[]): void => {
    for (const node of nodes) {
      nodeByPath.set(node.path, node)
      visiblePaths.push(node.path)
      if (node.kind === 'directory' && expanded.has(node.path)) walk(node.children)
    }
  }
  walk(tree)
  return { visiblePaths, nodeByPath }
}

/** One tree node row: directory toggles, file shows its badge. */
function TreeNode({
  node, expanded, onToggle, activePath, onRowFocus, registerRow, t,
}: {
  node: GitTreeNode
  expanded: ReadonlySet<string>
  onToggle: (path: string) => void
  activePath: string | undefined
  onRowFocus: (path: string) => void
  registerRow: (path: string, element: HTMLElement | null) => void
  t: TranslateNS<'gitPanel'>
}): ReactNode {
  if (node.kind === 'directory') {
    const open = expanded.has(node.path)
    const hasChildren = node.children.length > 0
    const firstState = [...node.states][0]
    return (
      <li className={css.item} role="none">
        <button
          type="button"
          role="treeitem"
          className={css.row}
          aria-expanded={hasChildren ? open : undefined}
          tabIndex={node.path === activePath ? 0 : -1}
          ref={el => { registerRow(node.path, el) }}
          onFocus={() => { onRowFocus(node.path) }}
          onClick={() => { if (hasChildren) onToggle(node.path) }}
        >
          {hasChildren
            ? (open
              ? <IconChevronDownOutlineRegular className={css.chevron} />
              : <IconChevronRightOutlineRegular className={css.chevron} />)
            : <span className={css.chevronSpacer} />}
          <span className={css.name}>{node.name}/</span>
          {firstState !== undefined && (
            <span className={clsx(css.stateBadge, stateClass(firstState))}>
              {stateLetter(firstState)}
            </span>
          )}
        </button>
        {open && hasChildren && (
          <ul role="group" className={css.tree}>
            {node.children.map(child => (
              <TreeNode
                key={child.path}
                node={child}
                expanded={expanded}
                onToggle={onToggle}
                activePath={activePath}
                onRowFocus={onRowFocus}
                registerRow={registerRow}
                t={t}
              />
            ))}
          </ul>
        )}
      </li>
    )
  }
  return (
    <li className={css.item} role="none">
      <span
        role="treeitem"
        className={css.row}
        tabIndex={node.path === activePath ? 0 : -1}
        ref={el => { registerRow(node.path, el) }}
        onFocus={() => { onRowFocus(node.path) }}
      >
        {node.staged && <span className={css.stagedDot} title={t('staged')} />}
        <span className={css.name}>{node.name}</span>
        <span
          className={clsx(css.stateBadge, stateClass(node.state))}
          title={stateLabel(t, node.state)}
          aria-label={stateLabel(t, node.state)}
        >
          {stateLetter(node.state)}
        </span>
      </span>
    </li>
  )
}

/** The unbound state: explanation and bind form. */
function UnboundForm({ gitPanel, t }: { gitPanel: IGitPanel; t: TranslateNS<'gitPanel'> }): ReactNode {
  const [remote, setRemote] = useState('')
  const [branch, setBranch] = useState('main')
  const [autoCommit, setAutoCommit] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)
  const mountedRef = useRef(true)

  useEffect(() => () => { mountedRef.current = false }, [])

  const bind = useCallback(async () => {
    if (remote.trim() === '') return
    setBusy(true)
    setError(undefined)
    try {
      await gitPanel.bind({ remote: remote.trim(), branch: branch.trim() || 'main', autoCommit })
    } catch (err) {
      if (mountedRef.current) setError(err instanceof Error ? err.message : String(err))
    } finally {
      if (mountedRef.current) setBusy(false)
    }
  }, [remote, branch, autoCommit, gitPanel])

  return (
    <div className={css.status}>
      <p className={css.statusLine}>{t('unbound.explanation')}</p>
      <div className={css.form}>
        <div className={css.field}>
          <label className={css.fieldLabel}>{t('unbound.remoteLabel')}</label>
          <input
            className={css.fieldInput}
            type="text"
            value={remote}
            placeholder={t('unbound.remotePlaceholder')}
            onChange={e => { setRemote(e.target.value) }}
            disabled={busy}
          />
        </div>
        <div className={css.field}>
          <label className={css.fieldLabel}>{t('unbound.branchLabel')}</label>
          <input
            className={css.fieldInput}
            type="text"
            value={branch}
            onChange={e => { setBranch(e.target.value) }}
            disabled={busy}
          />
        </div>
        <div className={css.checkboxRow}>
          <input
            type="checkbox"
            id="git-auto-commit"
            checked={autoCommit}
            onChange={e => { setAutoCommit(e.target.checked) }}
            disabled={busy}
          />
          <label className={css.checkboxLabel} htmlFor="git-auto-commit">{t('unbound.autoCommitLabel')}</label>
        </div>
        {error !== undefined && <p className={css.error}>{error}</p>}
        <div className={css.actions}>
          <button
            type="button"
            className={clsx(css.button, css.buttonPrimary)}
            disabled={busy || remote.trim() === ''}
            onClick={bind}
          >
            {t('unbound.bind')}
          </button>
        </div>
      </div>
    </div>
  )
}

/** The bound state: header with badges, changed-files tree, commit list. */
function BoundView({
  gitPanel, view, t,
}: {
  gitPanel: IGitPanel
  view: GitPanelView
  t: TranslateNS<'gitPanel'>
}): ReactNode {
  const status = view.view!
  const tree = useMemo(() => buildGitTree(status.changes), [status.changes])
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())
  const [activePath, setActivePath] = useState<string | undefined>(undefined)
  const itemRefs = useRef(new Map<string, HTMLElement>())

  const { visiblePaths, nodeByPath } = useMemo(
    () => flattenVisible(tree, expanded),
    [tree, expanded],
  )

  // Roving tabindex: the active row (or the first visible row) owns tab focus.
  const effectiveActivePath = activePath !== undefined && visiblePaths.includes(activePath)
    ? activePath
    : visiblePaths[0]

  const registerRow = useCallback((path: string, element: HTMLElement | null) => {
    if (element === null) itemRefs.current.delete(path)
    else itemRefs.current.set(path, element)
  }, [])

  // Focus follows the active row once the user has navigated the tree.
  useEffect(() => {
    if (activePath === undefined) return
    const target = itemRefs.current.get(activePath)
      ?? (effectiveActivePath !== undefined ? itemRefs.current.get(effectiveActivePath) : undefined)
    target?.focus()
  }, [activePath, effectiveActivePath])

  const toggleExpanded = useCallback((path: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])

  // Roving keyboard navigation over the visible rows (treeview pattern).
  const handleTreeKeyDown = useCallback((event: KeyboardEvent<HTMLElement>) => {
    if (visiblePaths.length === 0 || effectiveActivePath === undefined) return
    const index = visiblePaths.indexOf(effectiveActivePath)
    if (index < 0) return
    const move = (next: number): void => {
      event.preventDefault()
      const path = visiblePaths[next]
      if (path !== undefined) setActivePath(path)
    }
    switch (event.key) {
      case 'ArrowDown':
        move(Math.min(index + 1, visiblePaths.length - 1))
        break
      case 'ArrowUp':
        move(Math.max(index - 1, 0))
        break
      case 'ArrowRight': {
        const node = nodeByPath.get(effectiveActivePath)
        if (node === undefined || node.kind !== 'directory' || node.children.length === 0) break
        if (!expanded.has(effectiveActivePath)) {
          event.preventDefault()
          toggleExpanded(effectiveActivePath)
        } else {
          move(index + 1)
        }
        break
      }
      case 'ArrowLeft': {
        const node = nodeByPath.get(effectiveActivePath)
        if (node !== undefined && node.kind === 'directory' && expanded.has(effectiveActivePath)) {
          event.preventDefault()
          toggleExpanded(effectiveActivePath)
          break
        }
        const slash = effectiveActivePath.lastIndexOf('/')
        if (slash > 0) move(visiblePaths.indexOf(effectiveActivePath.slice(0, slash)))
        break
      }
      case 'Home':
        move(0)
        break
      case 'End':
        move(visiblePaths.length - 1)
        break
    }
  }, [visiblePaths, effectiveActivePath, nodeByPath, expanded, toggleExpanded])

  const refresh = useCallback(() => { void gitPanel.refresh() }, [gitPanel])
  const unbind = useCallback(() => { void gitPanel.unbind() }, [gitPanel])

  const toggleAutoCommit = useCallback(() => {
    if (status.binding === undefined) return
    void gitPanel.setAutoCommit(!status.binding.autoCommit)
  }, [gitPanel, status.binding])

  const binding = status.binding

  return (
    <div className={css.root}>
      <div className={css.header}>
        <div className={css.headerInfo}>
          <IconBranchOutlineRegular className={css.titleIcon} />
          <span className={css.branch}>{status.repository?.branch ?? binding?.activeBranch ?? '?'}</span>
          {binding !== undefined && (
            <span className={css.remote} title={binding.remote}>{binding.remote}</span>
          )}
          <div className={css.badges}>
            {status.ahead > 0 && (
              <span className={clsx(css.badge, css.badgeAhead)}>
                {status.ahead} {t('ahead')}
              </span>
            )}
            {status.behind > 0 && (
              <span className={clsx(css.badge, css.badgeBehind)}>
                {status.behind} {t('behind')}
              </span>
            )}
          </div>
        </div>
        {binding !== undefined && (
          <button
            type="button"
            className={css.tool}
            aria-label={t(binding.autoCommit ? 'bound.autoCommit.disable' : 'bound.autoCommit.enable')}
            aria-pressed={binding.autoCommit}
            title={t(binding.autoCommit ? 'bound.autoCommit.disable' : 'bound.autoCommit.enable')}
            onClick={toggleAutoCommit}
          >
            <span className={css.toolGlyph}>{binding.autoCommit ? 'A' : '·'}</span>
          </button>
        )}
        <Tooltip label={t('refresh')} side="bottom" delayMs={500}>
          <button type="button" className={css.tool} aria-label={t('refresh')} onClick={refresh}>
            <IconRefreshOutlineRegular />
          </button>
        </Tooltip>
        <Tooltip label={t('unbind')} side="bottom" delayMs={500}>
          <button type="button" className={css.tool} aria-label={t('unbind')} onClick={unbind}>
            <span className={css.toolGlyphLarge}>✕</span>
          </button>
        </Tooltip>
      </div>
      <div className={css.body}>
        {status.clean && status.changes.length === 0 && (
          <p className={css.note}>{t('clean')}</p>
        )}
        {tree.length > 0 && (
          <div className={css.section}>
            <h3 className={css.sectionTitle}>{t('changedFiles')}</h3>
            <ul
              role="tree"
              aria-label={t('changedFiles')}
              className={css.tree}
              onKeyDown={handleTreeKeyDown}
            >
              {tree.map(node => (
                <TreeNode
                  key={node.path}
                  node={node}
                  expanded={expanded}
                  onToggle={toggleExpanded}
                  activePath={effectiveActivePath}
                  onRowFocus={setActivePath}
                  registerRow={registerRow}
                  t={t}
                />
              ))}
            </ul>
          </div>
        )}
        {status.commits.length > 0 && (
          <div className={css.section}>
            <h3 className={css.sectionTitle}>{t('commits')}</h3>
            {status.commits.map(commit => (
              <div key={commit.oid} className={css.commitRow}>
                <span className={css.commitOid}>{commit.shortOid}</span>
                <span className={css.commitMessage}>{commit.message.split('\n')[0]}</span>
                <span className={css.commitMeta}>{commit.author} · {relativeTime(t, commit.timestamp)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/** Subscribe to the git panel controller and render the appropriate view. */
export function GitPanelBody({ gitPanel, workspaceId, t }: GitPanelBodyProps): ReactNode {
  // Follow the workspace when it changes.
  useEffect(() => {
    if (workspaceId !== undefined) void gitPanel.follow(workspaceId)
  }, [gitPanel, workspaceId])

  const view = useSyncExternalStore(
    gitPanel.subscribe.bind(gitPanel),
    () => gitPanel.read(),
  )

  const loading = view.status === 'loading'
  const bound = view.view?.bound === true

  if (loading) {
    return (
      <div className={css.status}>
        <p className={css.statusLine}>{t('loading')}</p>
      </div>
    )
  }

  if (view.status === 'error' || view.error !== undefined) {
    return (
      <div className={css.status}>
        <p className={css.statusLine}>{t('error.title')}</p>
        {view.error !== undefined && <p className={css.error}>{view.error}</p>}
        <div className={css.actions}>
          <button
            type="button"
            className={clsx(css.button, css.buttonPrimary)}
            onClick={() => { void gitPanel.refresh() }}
          >
            {t('retry')}
          </button>
        </div>
      </div>
    )
  }

  if (!bound) {
    return <UnboundForm gitPanel={gitPanel} t={t} />
  }

  return <BoundView gitPanel={gitPanel} view={view} t={t} />
}
