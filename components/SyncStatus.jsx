import { useState, useEffect, useCallback } from 'react';
import {
  getPendingCount,
  getRecordsByStatus,
  getSetting,
} from '../lib/db';
import { syncPendingRecords, retryFailedRecords } from '../lib/sync';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { timeAgo } from '../lib/utils';

function CloudSyncIcon() {
  return (
    <svg className="h-5 w-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
      />
    </svg>
  );
}

export default function SyncStatus({ compact = false, onSyncComplete }) {
  const { isOnline } = useOnlineStatus();
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [lastSyncStats, setLastSyncStats] = useState(null);

  const refreshData = useCallback(async () => {
    const [pending, failed, syncTime, syncStats] = await Promise.all([
      getPendingCount(),
      getRecordsByStatus('failed'),
      getSetting('lastSyncTime'),
      getSetting('lastSyncStats'),
    ]);

    setPendingCount(pending);
    setFailedCount(failed.length);
    setLastSyncTime(syncTime);

    if (syncStats) {
      try {
        setLastSyncStats(JSON.parse(syncStats));
      } catch {
        setLastSyncStats(null);
      }
    } else {
      setLastSyncStats(null);
    }
  }, []);

  useEffect(() => {
    refreshData();

    const intervalId = setInterval(() => {
      refreshData();
    }, 30000);

    return () => clearInterval(intervalId);
  }, [refreshData]);

  const handleSync = useCallback(async () => {
    setIsSyncing(true);
    try {
      await syncPendingRecords();
      await refreshData();
      onSyncComplete?.();
    } catch (error) {
      console.error('Sync error:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [refreshData, onSyncComplete]);

  const handleRetry = useCallback(async () => {
    setIsSyncing(true);
    try {
      await retryFailedRecords();
      await refreshData();
      onSyncComplete?.();
    } catch (error) {
      console.error('Retry error:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [refreshData, onSyncComplete]);

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-sm">
        {isSyncing ? (
          <>
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
            <span className="text-gray-600">Syncing...</span>
          </>
        ) : pendingCount > 0 ? (
          <>
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            <span className="text-amber-700">{pendingCount} pending</span>
            {isOnline && (
              <button
                type="button"
                onClick={handleSync}
                className="text-xs text-primary-600 underline"
              >
                Sync
              </button>
            )}
          </>
        ) : (
          <>
            <span className="h-2 w-2 rounded-full bg-green-500" />
            <span className="text-xs text-green-700">Synced</span>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-semibold text-gray-800">
          <CloudSyncIcon />
          Sync Status
        </h3>
        <span
          className={`rounded-full px-2 py-1 text-xs font-medium ${
            isOnline ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}
        >
          {isOnline ? '🟢 Online' : '🔴 Offline'}
        </span>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className={`rounded-lg p-3 ${pendingCount > 0 ? 'bg-amber-50' : 'bg-gray-50'}`}>
          <div
            className={`text-2xl font-bold ${
              pendingCount > 0 ? 'text-amber-600' : 'text-gray-400'
            }`}
          >
            {pendingCount}
          </div>
          <div className="mt-0.5 text-xs text-gray-600">Pending sync</div>
        </div>

        <div className={`rounded-lg p-3 ${failedCount > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
          <div
            className={`text-2xl font-bold ${
              failedCount > 0 ? 'text-red-600' : 'text-gray-400'
            }`}
          >
            {failedCount}
          </div>
          <div className="mt-0.5 text-xs text-gray-600">Failed</div>
        </div>
      </div>

      <p className="mb-3 text-xs text-gray-500">
        {lastSyncTime ? `Last synced: ${timeAgo(lastSyncTime)}` : 'Never synced'}
        {lastSyncStats && lastSyncStats.synced > 0 && (
          <span className="ml-1 text-green-600">(✓ {lastSyncStats.synced} records)</span>
        )}
      </p>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSync}
          disabled={isSyncing || !isOnline || pendingCount === 0}
          className="btn-primary flex flex-1 items-center justify-center gap-2 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSyncing ? (
            <>
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Syncing...
            </>
          ) : (
            'Sync Now'
          )}
        </button>

        {failedCount > 0 && (
          <button
            type="button"
            onClick={handleRetry}
            disabled={isSyncing || !isOnline}
            className="btn-secondary flex items-center gap-1 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            🔄 Retry
          </button>
        )}
      </div>

      {!isOnline && (
        <p className="mt-2 text-center text-xs text-gray-500">
          Connect to internet to sync records
        </p>
      )}

      {isOnline && pendingCount === 0 && failedCount === 0 && (
        <p className="mt-2 text-center text-xs text-green-600">✓ All records synced</p>
      )}
    </div>
  );
}
