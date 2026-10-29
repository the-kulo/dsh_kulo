/** Scrollable read-only Secure zone history. */

import { memo } from 'react'
import type { SecureZonePanelProps } from './contract/slots.ts'
import css from './SecureZonePanel.module.css'

export const SecureZonePanel = memo(function SecureZonePanel({
  useStore,
  useExchanges,
  t,
}: SecureZonePanelProps) {
  const failures = useStore(state => state.failures)
  const exchanges = useExchanges(value => value)

  return (
    <section className={css.root} aria-label={t('section.title')}>
      <div className={css.history} aria-live="polite">
        {exchanges.length === 0 ? (
          <div className={css.empty}>
            <p className={css.emptyTitle}>{t('empty.title')}</p>
            <p className={css.emptyBody}>{t('empty.body')}</p>
          </div>
        ) : (
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
