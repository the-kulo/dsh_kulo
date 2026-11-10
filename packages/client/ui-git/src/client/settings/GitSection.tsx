/** Git binding settings section: workspace selector, remote URL, branch chain, auto-commit. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { Button, IconChevronDownOutlineRegular, IconSearchOutlineRegular, Input, Menu, Switch } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { WorkspaceId, WorkspaceView } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { GitPanelView } from '@deepseek-ai/dsh-api-git-controller/client'
import type { GitBindInput } from '@deepseek-ai/dsh-api-git-controller/types'
import css from './GitSection.module.css'

/** Observable snapshot for the hooks compartment. */
interface ObservableSnapshot<T> {
  getSnapshot(): T
  subscribe(listener: () => void): () => void
}

/** Injected services and callbacks. */
export interface GitSectionInjected {
  hooks: {
    gitPanel: ObservableSnapshot<GitPanelView>
    workspaces: ObservableSnapshot<{ items: readonly WorkspaceView[] }>
  }
  bind: (workspaceId: WorkspaceId, input: GitBindInput) => Promise<void>
  unbind: (workspaceId: WorkspaceId) => Promise<void>
  follow: (workspaceId: WorkspaceId) => Promise<void>
  promote: (workspaceId: WorkspaceId) => Promise<void>
  checkoutBranch: (workspaceId: WorkspaceId, branch: string) => Promise<void>
}

/** Props assembled by the settings renderer. */
export type GitSectionProps = PropsRuntime<'settings.section'> & PropsLocale<'settings.git'> & InjectFace<GitSectionInjected>

const DEFAULT_BRANCH = 'main'
const REMOTE_REGEX = /^\S+$/u
/** Five 34px rows plus the menu's 8px vertical padding. */
const WORKSPACE_LIST_MAX_HEIGHT = 5 * 34 + 8

/**
 * Render the git binding settings section.
 * @param props - injected hooks, callbacks, locale, and close.
 * @returns the settings section element.
 */
export function GitSection({ useGitPanel, useWorkspaces, bind, unbind, follow, promote, checkoutBranch, t }: GitSectionProps) {
  const panel = useGitPanel(s => s)
  const workspacesState = useWorkspaces(s => s)

  const [workspaceId, setWorkspaceId] = useState<WorkspaceId | undefined>(panel.workspaceId)
  const [remote, setRemote] = useState('')
  const [branchChain, setBranchChain] = useState(DEFAULT_BRANCH)
  const [autoCommit, setAutoCommit] = useState(true)
  const [editing, setEditing] = useState(false)
  const [inFlight, setInFlight] = useState(false)
  const [localError, setLocalError] = useState('')
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false)
  const [workspaceFilter, setWorkspaceFilter] = useState('')
  const [branchMenuOpen, setBranchMenuOpen] = useState(false)
  const selectorRef = useRef<HTMLButtonElement>(null)
  const branchRef = useRef<HTMLButtonElement>(null)

  // Follow the selected workspace on the Host.
  useEffect(() => {
    if (workspaceId === undefined) return
    void follow(workspaceId)
  }, [workspaceId, follow])

  // Sync form fields from the panel binding when it arrives (and we aren't editing).
  const binding = panel.view?.binding
  useEffect(() => {
    if (editing || binding === undefined) return
    setRemote(binding.remote)
    setBranchChain(binding.branches.join(', '))
    setAutoCommit(binding.autoCommit)
  }, [binding, editing])

  const workspaceItems = useMemo(() => {
    const items = workspacesState.items ?? []
    return items
  }, [workspacesState.items])

  const selectedWorkspace = useMemo(() =>
    workspaceItems.find(w => w.workspaceId === workspaceId),
  [workspaceItems, workspaceId])

  const filteredWorkspaces = useMemo(() => {
    const query = workspaceFilter.trim().toLowerCase()
    if (query === '') return workspaceItems
    return workspaceItems.filter(w => w.title.toLowerCase().includes(query))
  }, [workspaceItems, workspaceFilter])

  // Compute the display error: panel error (Host-refused) or local validation.
  const error = panel.error ?? localError

  const clearError = useCallback(() => {
    setLocalError('')
  }, [])

  const selectWorkspace = useCallback((nextId: string) => {
    selectorRef.current?.focus({ preventScroll: true })
    setWorkspaceMenuOpen(false)
    setWorkspaceId(nextId as WorkspaceId)
    setEditing(false)
    setLocalError('')
  }, [])

  const validate = useCallback((): boolean => {
    if (!REMOTE_REGEX.test(remote.trim())) {
      setLocalError(t('remoteRequired'))
      return false
    }
    return true
  }, [remote, t])

  /** Split the comma-separated chain, trimming and dropping duplicates. */
  const parseBranches = useCallback((): readonly string[] => {
    const seen = new Set<string>()
    const branches: string[] = []
    for (const part of branchChain.split(',')) {
      const branch = part.trim()
      if (branch === '' || seen.has(branch)) continue
      seen.add(branch)
      branches.push(branch)
    }
    return branches
  }, [branchChain])

  const handleBind = useCallback(async () => {
    if (workspaceId === undefined) return
    clearError()
    if (!validate()) return
    const branches = parseBranches()
    setInFlight(true)
    try {
      await bind(workspaceId, {
        remote: remote.trim(),
        branch: branches[0] ?? DEFAULT_BRANCH,
        branches: branches.length > 0 ? branches : [DEFAULT_BRANCH],
        autoCommit,
      })
      setEditing(false)
    } catch (err) {
      setLocalError(`${t('bindFailed')}: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setInFlight(false)
    }
  }, [workspaceId, remote, parseBranches, autoCommit, bind, clearError, t, validate])

  const handleUnbind = useCallback(async () => {
    if (workspaceId === undefined) return
    clearError()
    setInFlight(true)
    try {
      await unbind(workspaceId)
    } catch (err) {
      setLocalError(`${t('unbindFailed')}: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setInFlight(false)
    }
  }, [workspaceId, unbind, clearError, t])

  const handleEdit = useCallback(() => {
    if (binding !== undefined) {
      setRemote(binding.remote)
      setBranchChain(binding.branches.join(', '))
      setAutoCommit(binding.autoCommit)
    }
    setEditing(true)
    clearError()
  }, [binding, clearError])

  const handleCancelEdit = useCallback(() => {
    setEditing(false)
    clearError()
  }, [clearError])

  const handlePromote = useCallback(async () => {
    if (workspaceId === undefined) return
    clearError()
    setInFlight(true)
    try {
      await promote(workspaceId)
    } catch (err) {
      setLocalError(`${t('promoteFailed')}: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setInFlight(false)
    }
  }, [workspaceId, promote, clearError, t])

  const handleCheckout = useCallback(async (branch: string) => {
    if (workspaceId === undefined) return
    branchRef.current?.focus({ preventScroll: true })
    setBranchMenuOpen(false)
    clearError()
    setInFlight(true)
    try {
      await checkoutBranch(workspaceId, branch)
    } catch (err) {
      setLocalError(`${t('switchBranch')}: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setInFlight(false)
    }
  }, [workspaceId, checkoutBranch, clearError, t])

  const isBound = panel.view?.bound === true
  const showForm = !isBound || editing
  const showBinding = isBound && !editing
  const disabled = inFlight || panel.status === 'loading' || workspaceId === undefined
  const branches = binding?.branches ?? []
  const nextBranch = binding === undefined
    ? undefined
    : branches[branches.indexOf(binding.activeBranch) + 1]

  return (
    <section className={css.section}>
      <h2 className={css.title}>{t('title')}</h2>
      <p className={css.intro}>{t('sectionIntro')}</p>

      {/* Workspace selector */}
      <div className={css.field}>
        <label className={css.label}>{t('workspaceSelect')}</label>
        <Menu
          open={workspaceMenuOpen}
          onClose={() => { setWorkspaceMenuOpen(false) }}
          items={filteredWorkspaces.map(w => ({ id: w.workspaceId, label: w.title }))}
          selectedId={workspaceId}
          onSelect={selectWorkspace}
          align="start"
          portal
          maxHeight={WORKSPACE_LIST_MAX_HEIGHT}
          header={(
            <Input
              icon={<IconSearchOutlineRegular />}
              value={workspaceFilter}
              onChange={e => { setWorkspaceFilter(e.target.value) }}
              placeholder={t('workspaceSearch')}
              aria-label={t('workspaceSearch')}
              autoFocus
            />
          )}
          anchor={(
            <button
              ref={selectorRef}
              type="button"
              className={css.selector}
              aria-haspopup="menu"
              aria-expanded={workspaceMenuOpen}
              onClick={() => { setWorkspaceMenuOpen(v => !v) }}
              disabled={inFlight}
            >
              {selectedWorkspace?.title ?? t('workspacePlaceholder')}
              <IconChevronDownOutlineRegular className={css.chevron} />
            </button>
          )}
        />
      </div>

      {workspaceId === undefined ? (
        <p className={css.hint}>{t('noWorkspaceHint')}</p>
      ) : selectedWorkspace !== undefined ? (
        <p className={css.workspacePath}>{selectedWorkspace.path}</p>
      ) : null}

      {/* Error surface */}
      {error !== '' ? <p className={css.error} role="alert">{error}</p> : null}

      {/* Current binding display */}
      {showBinding && binding !== undefined ? (
        <div className={css.bindingDisplay}>
          <p className={css.bindingText}>
            {t('boundTo').replace('{remote}', binding.remote).replace('{branch}', binding.activeBranch)}
          </p>
          <div className={css.chain} aria-label={t('branchChain')}>
            {branches.map((branch, index) => (
              <span key={branch} className={clsx(css.chainItem, branch === binding.activeBranch && css.chainActive)}>
                {index > 0 ? <span className={css.chainArrow} aria-hidden="true">→</span> : null}
                {branch}
              </span>
            ))}
          </div>
          <p className={css.bindingMeta}>
            {t('autoCommit')}: {binding.autoCommit ? '✓' : '✗'} &nbsp;·&nbsp; {t('boundAt')}: {new Date(binding.boundAt).toLocaleString()}
          </p>
          <div className={css.bindingActions}>
            {nextBranch !== undefined ? (
              <Button variant="primary" size="sm" onClick={handlePromote} disabled={disabled}>
                {t('promoteTo').replace('{branch}', nextBranch)}
              </Button>
            ) : null}
            <Menu
              open={branchMenuOpen}
              onClose={() => { setBranchMenuOpen(false) }}
              items={branches.map(branch => ({ id: branch, label: branch }))}
              selectedId={binding.activeBranch}
              onSelect={id => { void handleCheckout(id) }}
              align="start"
              portal
              anchor={(
                <button
                  ref={branchRef}
                  type="button"
                  className={css.branchSwitch}
                  aria-haspopup="menu"
                  aria-expanded={branchMenuOpen}
                  onClick={() => { setBranchMenuOpen(v => !v) }}
                  disabled={disabled}
                >
                  {t('switchBranch')}: {binding.activeBranch}
                  <IconChevronDownOutlineRegular className={css.chevron} />
                </button>
              )}
            />
            <Button variant="outline" size="sm" onClick={handleEdit} disabled={disabled}>
              {t('editBinding')}
            </Button>
            <Button variant="outline" size="sm" onClick={handleUnbind} disabled={disabled}>
              {t('unbind')}
            </Button>
          </div>
        </div>
      ) : null}

      {/* Bind form */}
      {showForm ? (
        <div className={css.form}>
          <div className={css.field}>
            <label className={css.label} htmlFor="git-remote-url">{t('remoteUrl')}</label>
            <Input
              id="git-remote-url"
              className={css.textInput as string}
              placeholder={t('remoteUrlPlaceholder')}
              value={remote}
              onChange={e => { setRemote(e.target.value); clearError() }}
              disabled={disabled}
            />
          </div>

          <div className={css.field}>
            <label className={css.label} htmlFor="git-branch-chain">{t('branchChain')}</label>
            <Input
              id="git-branch-chain"
              className={css.textInput as string}
              placeholder={t('branchChainPlaceholder')}
              value={branchChain}
              onChange={e => { setBranchChain(e.target.value); clearError() }}
              disabled={disabled}
            />
            <p className={css.hint}>{t('branchChainHint')}</p>
          </div>

          <div className={css.field}>
            <Switch
              checked={autoCommit}
              onChange={v => { setAutoCommit(v) }}
              label={t('autoCommit')}
              disabled={disabled}
            />
            <p className={css.hint}>{t('autoCommitHint')}</p>
          </div>

          <div className={css.formActions}>
            <Button variant="primary" size="md" onClick={handleBind} disabled={disabled}>
              {inFlight ? t('loading') : t('bind')}
            </Button>
            {editing ? (
              <Button variant="ghost" size="md" onClick={handleCancelEdit} disabled={inFlight}>
                {t('cancelEdit')}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  )
}
