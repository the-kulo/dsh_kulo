// @vitest-environment jsdom
/** Git settings section: the workspace selector is a themed menu, not a native select. */

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { GitPanelView } from '@deepseek-ai/dsh-api-git-controller/client'
import type { WorkspaceId, WorkspaceView } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { GitBindingView } from '@deepseek-ai/dsh-api-git-controller/types'
import { GitSection, type GitSectionProps } from '../src/client/settings/GitSection.tsx'
import { en, type GitSettingsKey } from '../src/client/settings/locales.ts'

const t: TranslateNS<'settings.git'> = (key, params) => {
  const template = key in en ? en[key as GitSettingsKey] : key
  return template.replace(/\{(\w+)\}/g, (match, name) => String(params?.[name] ?? match))
}

const workspaces: readonly WorkspaceView[] = [
  {
    workspaceId: 'ws-1' as WorkspaceId,
    path: '/repo/alpha',
    title: 'Alpha',
    sessionIds: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    workspaceId: 'ws-2' as WorkspaceId,
    path: '/repo/beta',
    title: 'Beta',
    sessionIds: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
]

function renderSection(workspaceId?: WorkspaceId, binding?: GitBindingView) {
  const panel: GitPanelView = {
    workspaceId,
    status: workspaceId === undefined ? 'idle' : 'ready',
    view: binding === undefined ? undefined : {
      bound: true,
      binding,
      clean: true,
      ahead: 0,
      behind: 0,
      changes: [],
      commits: [],
    },
    error: undefined,
  }
  const props = {
    close: () => {},
    useGitPanel: <R,>(selector: (snapshot: GitPanelView) => R): R => selector(panel),
    useWorkspaces: <R,>(selector: (snapshot: { items: readonly WorkspaceView[] }) => R): R =>
      selector({ items: workspaces }),
    bind: vi.fn(),
    unbind: vi.fn(),
    follow: vi.fn(),
    promote: vi.fn(),
    checkoutBranch: vi.fn(),
    t,
  } as GitSectionProps
  return render(<GitSection {...props} />)
}

afterEach(cleanup)

describe('GitSection workspace selector', () => {
  it('uses a themed menu button instead of a native select', () => {
    renderSection()
    expect(screen.queryByRole('combobox')).toBeNull()
    expect(screen.getByRole('button', { name: en.workspacePlaceholder })).toBeTruthy()
  })

  it('lists the available workspaces when opened', () => {
    renderSection()
    fireEvent.click(screen.getByRole('button', { name: en.workspacePlaceholder }))
    const menu = screen.getByRole('menu')
    expect(menu.style.maxHeight).toBe('178px')
    expect(screen.getByText('Alpha')).toBeTruthy()
    expect(screen.getByText('Beta')).toBeTruthy()
  })

  it('filters the workspace list as the user types', () => {
    renderSection()
    fireEvent.click(screen.getByRole('button', { name: en.workspacePlaceholder }))
    fireEvent.change(screen.getByPlaceholderText(en.workspaceSearch), { target: { value: 'Beta' } })
    expect(screen.getByText('Beta')).toBeTruthy()
    expect(screen.queryByText('Alpha')).toBeNull()
  })

  it('shows the selected workspace and reports the selection', () => {
    renderSection('ws-2' as WorkspaceId)
    fireEvent.click(screen.getByRole('button', { name: 'Beta' }))
    expect(screen.getByText('Alpha')).toBeTruthy()
  })

  it('shows the branch chain and offers promotion to the next branch', () => {
    renderSection('ws-1' as WorkspaceId, {
      remote: 'git@github.com:org/repo.git',
      branches: ['feature', 'verify', 'stable'],
      activeBranch: 'feature',
      autoCommit: true,
      boundAt: '2026-01-01T00:00:00.000Z',
    })
    expect(screen.getByText('feature')).toBeTruthy()
    expect(screen.getByText('verify')).toBeTruthy()
    expect(screen.getByText('stable')).toBeTruthy()
    expect(screen.getByRole('button', { name: en.promoteTo.replace('{branch}', 'verify') })).toBeTruthy()
  })

  it('hides promotion at the end of the chain', () => {
    renderSection('ws-1' as WorkspaceId, {
      remote: 'git@github.com:org/repo.git',
      branches: ['feature', 'verify'],
      activeBranch: 'verify',
      autoCommit: true,
      boundAt: '2026-01-01T00:00:00.000Z',
    })
    expect(screen.queryByRole('button', { name: new RegExp(en.promote) })).toBeNull()
  })
})
