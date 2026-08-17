import { useState, useEffect } from 'react';

function useOnlineStatus() {
  // Default true so SSR and first client render match (navigator unavailable on server)
  const [isOnline, setIsOnline] = useState(true);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    setIsReady(true);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline, isReady };
}

export { useOnlineStatus };
export default useOnlineStatus;
