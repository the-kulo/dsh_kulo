/** Scrollable read-only Secure zone conversation list. */

import { memo } from 'react'
import type { SecureZonePanelProps } from './contract/slots.ts'
import css from './SecureZonePanel.module.css'

export const SecureZonePanel = memo(function SecureZonePanel({
  useStore,
  useSessionItems,
  openSession,
  t,
}: SecureZonePanelProps) {
  const failures = useStore(state => state.failures)
  const items = useSessionItems(value => value)

  return (
    <section className={css.root} aria-label={t('section.title')}>
      <div className={css.history} aria-live="polite">
        {items.length === 0 ? null : (
          <ol className={css.exchanges}>
            {items.map(item => (
              <li key={item.id}>
                <button
                  type="button"
                  className={css.sessionLink}
                  title={item.title}
                  onClick={() => { openSession(item.id) }}
                >
                  <span className={css.sessionTitle}>{item.title}</span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>
      {failures.length > 0 && <p className={css.error} role="alert">{failures.join(' ')}</p>}
    </section>
  )
})
