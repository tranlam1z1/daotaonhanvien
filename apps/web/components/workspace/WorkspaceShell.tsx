'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { accountError, apiUrl, sendAccountAction } from '../../lib/account-api';
import { availableSections, type Account } from '../../lib/workspace';
import { WorkspaceNotices } from './StageThree';
import { Button, EmptyState, Toast } from '../ui/controls';
import { Modal } from '../ui/Modal';

const AccountContext = createContext<Account | null>(null);

export function useAccount() {
  const account = useContext(AccountContext);
  if (!account) throw new Error('Workspace account is required');
  return account;
}

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [failure, setFailure] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(apiUrl + '/me', {
          credentials: 'include',
          cache: 'no-store',
          signal: controller.signal,
        });

        if (controller.signal.aborted) return;
        if (response.status === 401) {
          router.replace('/dang-nhap');
        } else if (response.ok) {
          const currentAccount: Account = await response.json();
          if (!controller.signal.aborted) setAccount(currentAccount);
        } else {
          setFailure(true);
        }
      } catch {
        if (!controller.signal.aborted) setFailure(true);
      }
    }
    void load();
    return () => controller.abort();
  }, [attempt, router]);

  if (!account) {
    return (
      <main className="mx-auto grid min-h-dvh max-w-md content-center gap-4 px-4">
        {failure ? (
          <>
            <EmptyState title="Chưa tải được tài khoản" />
            <Button
              onClick={() => {
                setFailure(false);
                setAttempt(attempt + 1);
              }}
            >
              Thử lại
            </Button>
          </>
        ) : (
          <p role="status" className="text-center text-sm text-slate-600">
            Đang kiểm tra phiên đăng nhập…
          </p>
        )}
      </main>
    );
  }

  return (
    <AccountContext.Provider value={account}>
      <WorkspaceNavigation>{children}</WorkspaceNavigation>
    </AccountContext.Provider>
  );
}

function WorkspaceNavigation({ children }: { children: ReactNode }) {
  const account = useAccount();
  const pathname = usePathname();
  const router = useRouter();
  const [mobilePath, setMobilePath] = useState<string | null>(null);
  const [notifications, setNotifications] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState('');
  const mobileOpen = mobilePath === pathname;
  const sections = [
    { href: '/ung-dung', label: 'Tổng quan' },
    ...availableSections(account.permissions).map(({ slug, label }) => ({
      href: '/ung-dung/' + slug,
      label,
    })),
  ];

  async function signOut() {
    setError('');
    setSigningOut(true);
    try {
      const response = await sendAccountAction('logout-all');
      if (response.ok || response.status === 401) {
        router.replace('/dang-nhap');
        return;
      }
      setError(await accountError(response));
    } catch {
      setError('Không kết nối được. Vui lòng thử lại.');
    }
    setSigningOut(false);
  }

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:grid-rows-[auto_1fr]">
      <a
        href="#noi-dung-chinh"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-3"
      >
        Đến nội dung chính
      </a>
      <header className="sticky top-0 z-20 flex min-h-16 min-w-0 items-center gap-2 border-b border-slate-200 bg-white px-3 py-2 sm:gap-4 sm:px-6 lg:col-start-2 lg:row-start-1">
        <Button
          variant="secondary"
          className="shrink-0 !px-2.5 lg:hidden"
          aria-controls="workspace-navigation"
          aria-expanded={mobileOpen}
          onClick={() => setMobilePath(mobileOpen ? null : pathname)}
        >
          Menu
        </Button>
        <p
          className="min-w-0 grow truncate text-sm font-bold text-navy-900"
          title={account.profile.tenantName ?? 'Nền tảng EduCore36'}
        >
          {account.profile.tenantName ?? 'Nền tảng EduCore36'}
        </p>
        <Button
          variant="secondary"
          className="shrink-0 !px-3"
          aria-label="Thông báo"
          aria-haspopup="dialog"
          onClick={() => setNotifications(true)}
        >
          <span aria-hidden="true" className="block text-lg leading-none">
            🔔
          </span>
        </Button>
        <details key={pathname} className="relative shrink-0">
          <summary className="flex min-h-11 cursor-pointer list-none items-center rounded-lg border border-slate-300 px-2.5 text-sm font-semibold text-navy-900 hover:bg-slate-100 [&::-webkit-details-marker]:hidden">
            Tài khoản
          </summary>
          <div className="absolute right-0 z-30 mt-2 w-60 max-w-[calc(100vw-1.5rem)] space-y-1 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
            <p className="break-words px-3 py-2 text-sm font-semibold">
              {account.profile.fullName}
            </p>
            <Link
              href="/ung-dung/ho-so"
              onClick={(event) =>
                event.currentTarget.closest('details')?.removeAttribute('open')
              }
              className="flex min-h-11 items-center rounded-lg px-3 text-sm hover:bg-slate-100"
            >
              Hồ sơ cá nhân
            </Link>
            <Button
              variant="secondary"
              className="w-full text-left"
              disabled={signingOut}
              onClick={() => void signOut()}
            >
              {signingOut ? 'Đang đăng xuất…' : 'Đăng xuất mọi thiết bị'}
            </Button>
          </div>
        </details>
      </header>

      <aside
        id="workspace-navigation"
        className={`${mobileOpen ? 'block' : 'hidden'} bg-navy-900 px-3 py-4 text-white lg:sticky lg:top-0 lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:block lg:h-dvh lg:overflow-auto lg:p-4`}
      >
        <Link
          href="/ung-dung"
          onClick={() => setMobilePath(null)}
          className="mb-4 inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-lg font-bold"
        >
          <span
            aria-hidden="true"
            className="rounded-lg bg-brand-blue px-2 py-1 text-sm"
          >
            E
          </span>
          EduCore36
        </Link>
        <nav aria-label="Điều hướng ứng dụng" className="grid gap-1">
          {sections.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              aria-current={pathname === href ? 'page' : undefined}
              onClick={() => setMobilePath(null)}
              className={`flex min-h-11 items-center rounded-lg px-3 py-2 text-sm font-medium ${pathname === href ? 'bg-brand-blue text-white' : 'text-slate-200 hover:bg-slate-800'}`}
            >
              {label}
            </Link>
          ))}
        </nav>
      </aside>

      <main
        id="noi-dung-chinh"
        tabIndex={-1}
        className="min-w-0 px-4 py-6 sm:px-6 sm:py-8 lg:col-start-2 lg:row-start-2 lg:px-8"
      >
        {children}
      </main>
      <Modal
        title="Thông báo"
        open={notifications}
        onClose={() => setNotifications(false)}
      >
        {notifications &&
          (account.tenantId ? (
            <WorkspaceNotices />
          ) : (
            <EmptyState title="Chưa có thông báo" />
          ))}
      </Modal>
      {error && (
        <Toast error onDismiss={() => setError('')}>
          {error}
        </Toast>
      )}
    </div>
  );
}
