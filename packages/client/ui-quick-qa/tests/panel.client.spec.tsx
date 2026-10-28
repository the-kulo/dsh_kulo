// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { bindSnapshotSelector, makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { en as commonEn } from '@deepseek-ai/dsh-client-locale/src/locales/en.ts'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import { QuickQaPanel } from '../src/client/QuickQaPanel.tsx'
import type { QuickQaPanelProps } from '../src/client/contract/slots.ts'
import { createQuickQaStore } from '../src/client/stores.ts'
import { en } from '../src/client/locales.ts'

afterEach(cleanup)

function props(exchanges: QuickQaPanelProps['useExchanges'], store = createQuickQaStore().create()): QuickQaPanelProps {
  return {
    useStore: bindSnapshotSelector(store),
    actions: store.actions,
    useExchanges: exchanges,
    t: makeTranslate(en, commonEn),
  }
}

describe('QuickQaPanel', () => {
  it('renders durable exchanges read-only, with no composer or model controls', () => {
    render(<QuickQaPanel {...props(bindSnapshotSelector(createSnapshotStore([
      { key: 1, question: 'Question', answer: 'Answer', active: false },
      { key: 2, question: 'Follow-up', answer: '', active: true },
    ])))} />)

    expect(screen.getByRole('region', { name: 'Quick answers' })).toBeTruthy()
    expect(screen.getByText('Question')).toBeTruthy()
    expect(screen.getByText('Answer')).toBeTruthy()
    expect(screen.getByText('Follow-up')).toBeTruthy()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.queryByRole('combobox')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('shows the empty state when no quick-answer history exists', () => {
    render(<QuickQaPanel {...props(bindSnapshotSelector(createSnapshotStore([])))} />)

    expect(screen.getByText('No quick answers yet')).toBeTruthy()
    expect(screen.queryByRole('list')).toBeNull()
  })

  it('surfaces restore failure lines as an alert', () => {
    const store = createQuickQaStore().create()
    store.actions.setFailures(['Temporarily unavailable. Please try again later.'])

    render(<QuickQaPanel {...props(bindSnapshotSelector(createSnapshotStore([])), store)} />)

    expect(screen.getByRole('alert').textContent).toContain('Temporarily unavailable')
  })
})
