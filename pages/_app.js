import { useEffect } from 'react';
import Head from 'next/head';
import '@/styles/globals.css';
import { setupAutoSync } from '../lib/sync';

let deferredInstallPrompt = null;

export function getDeferredInstallPrompt() {
  return deferredInstallPrompt;
}

export default function App({ Component, pageProps }) {
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    import('../lib/db')
      .then(({ initDB }) => {
        initDB().catch((error) => {
          console.error('DB init error:', error);
        });
      })
      .catch((error) => {
        console.error('DB import error:', error);
      });

    const cleanupSync = setupAutoSync();

    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch((error) => {
        console.error('Service worker registration failed:', error);
      });
    }

    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      deferredInstallPrompt = event;

      try {
        localStorage.setItem('pwaInstallPromptAvailable', 'true');
      } catch (error) {
        console.error('Failed to store install prompt flag:', error);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      cleanupSync();
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  return (
    <>
      <Head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
        />
      </Head>
      <div className="app-root">
        <Component {...pageProps} />
      </div>
    </>
  );
}
