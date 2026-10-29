/** Scrollable read-only Quick answers history. */

import { memo } from 'react'
import type { QuickQaPanelProps } from './contract/slots.ts'
import css from './QuickQaPanel.module.css'

export const QuickQaPanel = memo(function QuickQaPanel({
  useStore,
  useExchanges,
  t,
}: QuickQaPanelProps) {
  const failures = useStore(state => state.failures)
  const exchanges = useExchanges(value => value)

  return (
    <section className={css.root} aria-label={t('section.title')}>
      <div className={css.history} aria-live="polite">
        {exchanges.length === 0 ? null : (
          <ol className={css.exchanges}>
            {exchanges.map(item => (
              <li key={item.key}>
                <p className={css.question}>{item.question}</p>
                {item.answer.length > 0 && <p className={css.answer}>{item.answer}</p>}
              </li>
            ))}
          </ol>
        )}
      </div>
      {failures.length > 0 && <p className={css.error} role="alert">{failures.join(' ')}</p>}
    </section>
  )
})
