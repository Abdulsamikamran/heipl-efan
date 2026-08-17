import useOnlineStatus from '../hooks/useOnlineStatus';

export default function OfflineBanner() {
  const { isOnline, isReady } = useOnlineStatus();

  if (!isReady) {
    return null;
  }

  return (
    <div
      className={`overflow-hidden transition-all duration-300 ease-in-out ${
        isOnline ? 'max-h-0 opacity-0' : 'max-h-10 opacity-100'
      }`}
    >
      <div className="flex h-9 items-center justify-center bg-amber-100 px-4">
        <p className="text-center text-xs text-amber-800">
          📶 No internet connection – data saves locally and syncs when reconnected
        </p>
      </div>
    </div>
  );
}
