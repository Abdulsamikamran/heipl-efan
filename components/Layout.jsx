import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import OfflineBanner from './OfflineBanner';
import { getPendingCount } from '../lib/db';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

function HouseIcon({ active }) {
  const color = active ? '#006633' : '#9ca3af';
  return (
    <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
      />
    </svg>
  );
}

function PlusIcon({ active }) {
  const color = active ? '#006633' : '#9ca3af';
  return (
    <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function ListIcon({ active }) {
  const color = active ? '#006633' : '#9ca3af';
  return (
    <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
    </svg>
  );
}

function GearIcon({ active }) {
  const color = active ? '#006633' : '#9ca3af';
  return (
    <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function OnlineIndicator() {
  const { isOnline, isReady } = useOnlineStatus();

  if (!isReady) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-white/40" />
        <span className="text-xs text-white/60">...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`h-2.5 w-2.5 rounded-full ${isOnline ? 'bg-green-400' : 'bg-red-400'}`}
      />
      <span className="text-xs text-white/80">{isOnline ? 'Online' : 'Offline'}</span>
    </div>
  );
}

export default function Layout({ children, title }) {
  const router = useRouter();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const load = () => {
      getPendingCount().then((count) => setPendingCount(count));
    };

    load();
    window.addEventListener('focus', load);

    return () => window.removeEventListener('focus', load);
  }, []);

  const tabs = [
    {
      label: 'Dashboard',
      href: '/',
      icon: (active) => <HouseIcon active={active} />,
    },
    {
      label: 'New Form',
      href: '/form',
      icon: (active) => <PlusIcon active={active} />,
    },
    {
      label: 'Records',
      href: '/records',
      icon: (active) => <ListIcon active={active} />,
      badge: pendingCount,
    },
    {
      label: 'Settings',
      href: '/settings',
      icon: (active) => <GearIcon active={active} />,
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header
        className="fixed left-0 right-0 top-0 z-40 flex h-14 items-center bg-primary-600 px-4 text-white shadow-md"
      >
        {router.pathname !== '/' && (
          <button
            type="button"
            onClick={() => router.back()}
            className="-ml-1 mr-3 touch-manipulation rounded-lg p-1 active:bg-primary-700"
            aria-label="Go back"
          >
            <svg
              width="24"
              height="24"
              fill="none"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
          </button>
        )}

        <h1 className="flex-1 truncate text-lg font-semibold">{title}</h1>

        <OnlineIndicator />
      </header>

      <div className="fixed left-0 right-0 top-14 z-30">
        <OfflineBanner />
      </div>

      <main
        className="flex-1 overflow-y-auto"
        style={{
          paddingTop: '56px',
          paddingBottom: '80px',
        }}
      >
        {children}
      </main>

      <nav
        className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-gray-200 bg-white"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {tabs.map((tab) => {
          const active = router.pathname === tab.href;

          return (
            <button
              key={tab.href}
              type="button"
              onClick={() => router.push(tab.href)}
              className="relative flex min-h-[56px] flex-1 touch-manipulation flex-col items-center justify-center gap-0.5 py-2 active:bg-gray-50"
            >
              <div className="relative">
                {tab.icon(active)}
                {tab.badge > 0 && (
                  <span
                    className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white"
                  >
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </span>
                )}
              </div>
              <span
                className={`text-[11px] font-medium ${
                  active ? 'text-primary-600' : 'text-gray-400'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
