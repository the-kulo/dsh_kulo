/** Git binding settings section: workspace selector, remote URL, branch, auto-commit. */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Input, Switch } from '@deepseek-ai/dsh-client-ui-primitives'
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
}

/** Props assembled by the settings renderer. */
export type GitSectionProps = PropsRuntime<'settings.section'> & PropsLocale<'settings.git'> & InjectFace<GitSectionInjected>

const DEFAULT_BRANCH = 'main'
const REMOTE_REGEX = /^\S+$/u

/**
 * Render the git binding settings section.
 * @param props - injected hooks, callbacks, locale, and close.
 * @returns the settings section element.
 */
export function GitSection({ useGitPanel, useWorkspaces, bind, unbind, follow, t }: GitSectionProps) {
  const panel = useGitPanel(s => s)
  const workspacesState = useWorkspaces(s => s)

  const [workspaceId, setWorkspaceId] = useState<WorkspaceId | undefined>(panel.workspaceId)
  const [remote, setRemote] = useState('')
  const [branch, setBranch] = useState(DEFAULT_BRANCH)
  const [autoCommit, setAutoCommit] = useState(true)
  const [editing, setEditing] = useState(false)
  const [inFlight, setInFlight] = useState(false)
  const [localError, setLocalError] = useState('')

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
    setBranch(binding.branch)
    setAutoCommit(binding.autoCommit)
  }, [binding, editing])

  const workspaceItems = useMemo(() => {
    const items = workspacesState.items ?? []
    return items
  }, [workspacesState.items])

  const selectedWorkspace = useMemo(() =>
    workspaceItems.find(w => w.workspaceId === workspaceId),
  [workspaceItems, workspaceId])

  // Compute the display error: panel error (Host-refused) or local validation.
  const error = panel.error ?? localError

  const clearError = useCallback(() => {
    setLocalError('')
  }, [])

  const handleWorkspaceChange = useCallback((nextId: string) => {
    const id = nextId as WorkspaceId
    setWorkspaceId(id)
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

  const handleBind = useCallback(async () => {
    if (workspaceId === undefined) return
    clearError()
    if (!validate()) return
    setInFlight(true)
    try {
      await bind(workspaceId, { remote: remote.trim(), branch: branch.trim() || DEFAULT_BRANCH, autoCommit })
      setEditing(false)
    } catch (err) {
      setLocalError(`${t('bindFailed')}: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setInFlight(false)
    }
  }, [workspaceId, remote, branch, autoCommit, bind, clearError, t, validate])

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
      setBranch(binding.branch)
      setAutoCommit(binding.autoCommit)
    }
    setEditing(true)
    clearError()
  }, [binding, clearError])

  const handleCancelEdit = useCallback(() => {
    setEditing(false)
    clearError()
  }, [clearError])

  const isBound = panel.view?.bound === true
  const showForm = !isBound || editing
  const showBinding = isBound && !editing
  const disabled = inFlight || panel.status === 'loading' || workspaceId === undefined

  return (
    <section className={css.section}>
      <h2 className={css.title}>{t('title')}</h2>
      <p className={css.intro}>{t('sectionIntro')}</p>

      {/* Workspace selector */}
      <div className={css.field}>
        <label className={css.label} htmlFor="git-workspace-select">{t('workspaceSelect')}</label>
        <select
          id="git-workspace-select"
          className={css.select}
          value={workspaceId ?? ''}
          onChange={e => { handleWorkspaceChange(e.target.value) }}
          disabled={inFlight}
        >
          <option value="" disabled>{t('noWorkspace')}</option>
          {workspaceItems.map(w => (
            <option key={w.workspaceId} value={w.workspaceId}>{w.title}</option>
          ))}
        </select>
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
            {t('boundTo').replace('{remote}', binding.remote).replace('{branch}', binding.branch)}
          </p>
          <p className={css.bindingMeta}>
            {t('autoCommit')}: {binding.autoCommit ? '✓' : '✗'} &nbsp;·&nbsp; {t('boundAt')}: {new Date(binding.boundAt).toLocaleString()}
          </p>
          <div className={css.bindingActions}>
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
            <label className={css.label} htmlFor="git-branch">{t('branch')}</label>
            <Input
              id="git-branch"
              className={css.textInput as string}
              value={branch}
              onChange={e => { setBranch(e.target.value); clearError() }}
              disabled={disabled}
            />
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
