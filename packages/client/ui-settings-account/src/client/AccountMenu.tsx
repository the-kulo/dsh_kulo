/** Sidebar account launcher and locally authoritative sign-out action. */
import { useEffect, useRef, useState } from 'react'
import {
  Toast, Menu, IconEllipsisOutlineMedium, IconUserOutlineMedium, Tooltip,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls the sidebar's `sidebar.account` slot declaration.
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type { AccountSectionInjected } from './AccountSection.tsx'
import { SignOutDialog } from './SignOutDialog.tsx'
import { SignInDialog } from './SignInDialog.tsx'
import { LogoutIcon } from './LogoutIcon.tsx'
import { AccountNoticeStack } from './AccountNotice.tsx'
import avatarUrl from './assets/the_kulo_avatar.jpg'
import css from './AccountMenu.module.css'

/** Account launcher composed by the sidebar top seat. */
export type AccountMenuProps = PropsRuntime<'sidebar.account'> & PropsLocale<'settings.account'> & InjectFace<AccountSectionInjected>

/**
 * The top account launcher: a compact avatar icon with a tooltip. Its menu
 * keeps the sign-in/sign-out actions; Settings has its own sidebar button.
 * @param props - sidebar geometry, account operations and localized copy.
 * @returns account menu launcher.
 */
export function AccountMenu({
  wide, subscribeSessionExpired, subscribeModelSignInRequired, openOnboarding,
  useAccount, useTheme, signOut, hasRunningAccountTasks, bonusNoticeShown, bonusNoticeDismissed,
  showLogin, start, cancel, t,
}: AccountMenuProps) {
  const anchor = useRef<HTMLDivElement>(null)
  const account = useAccount(state => state)
  const colorScheme = useTheme(snapshot => snapshot.active.colorScheme)
  const signedIn = account.view?.status === 'credential-stored'
  const [signInNotice, setSignInNotice] = useState(0)
  useEffect(() => subscribeModelSignInRequired?.(() => { setSignInNotice(value => value + 1) }), [subscribeModelSignInRequired])
  const [expiryNotice, setExpiryNotice] = useState(false)
  useEffect(() => subscribeSessionExpired?.(() => { setExpiryNotice(true) }), [subscribeSessionExpired])
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [signOutImpact, setSignOutImpact] = useState<boolean | 'unknown'>()
  const requestSignOut = async () => {
    setBusy(true)
    try { setSignOutImpact(await hasRunningAccountTasks()); setOpen(false) }
    catch (_error) { setSignOutImpact('unknown'); setOpen(false) }
    finally { setBusy(false) }
  }
  // The plugin's start publishes `loginFailed` before it rejects, so the dialog owns the report.
  const beginSignIn = (): void => { setOpen(false); void start().catch(() => undefined) }
  return <div ref={anchor} className={css.root}>
    {signInNotice > 0 && <Toast key={signInNotice} text={t('modelSignInRequired')} onDone={() => { setSignInNotice(0) }} />}
    {expiryNotice && <Toast text={t('sessionExpired')} onDone={() => { setExpiryNotice(false) }} />}
    {signedIn && !account.desktopOnboardingVisible && !account.onboarding && account.notices && <AccountNoticeStack
      notices={account.notices}
      anchor={anchor} title={t('bonusNoticeTitle')} closeLabel={t('close')}
      onShown={bonusNoticeShown} onDismiss={bonusNoticeDismissed} />}
    <Menu open={open} side="bottom" portal autoFocus className={css.anchor} listClassName={signedIn ? undefined : css.signedOutMenu}
      anchor={
        <Tooltip label={signedIn ? t('username') : t('menu')} delayMs={500}>
          <button type="button" className={css.trigger} data-collapsed={!wide} data-signed-out={!signedIn} aria-label={t('menu')}
            aria-haspopup="menu" aria-expanded={open} onClick={() => { setOpen(value => !value) }}>
            {signedIn
              ? <span className={css.avatar}><img className={css.avatarImage} src={avatarUrl} alt="" /></span>
              : <IconEllipsisOutlineMedium size={14} />}
          </button>
        </Tooltip>}
      items={[
        ...(signedIn ? [{ id: 'signout', label: t('signOut'), icon: <LogoutIcon />, disabled: busy }]
          : [{ id: 'signin', label: t('signIn'), icon: <IconUserOutlineMedium size={16} /> }]),
      ]}
      onClose={() => { setOpen(false) }}
      onSelect={(id) => {
        if (id === 'signin') beginSignIn()
        else void requestSignOut()
      }} />
    {account.loginVisible && !account.onboarding && <SignInDialog account={account} colorScheme={colorScheme}
      start={start} cancel={cancel} t={t}
      close={() => { showLogin(false) }} useApiKey={() => { showLogin(false); openOnboarding('deepseek-official') }} />}
    {signedIn && signOutImpact !== undefined && <SignOutDialog running={signOutImpact} signOut={signOut}
      close={() => { setSignOutImpact(undefined) }} t={t} />}
  </div>
}
