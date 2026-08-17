import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import { getAllRecords, deleteRecord, updateRecord } from '../lib/db';
import { syncPendingRecords, retryFailedRecords } from '../lib/sync';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { timeAgo } from '../lib/utils';

function RecordCard({ record, onEdit, onDelete, onRetry, isOnline }) {
  const statusClass = {
    pending: 'bg-amber-100 text-amber-700',
    synced: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
    draft: 'bg-gray-100 text-gray-500',
  }[record.syncStatus] || 'bg-gray-100 text-gray-500';

  const locationParts = [record.addressCity, record.district, record.discoUtility]
    .filter(Boolean)
    .join(' · ');

  return (
    <div>
      <div
        className="cursor-pointer rounded-xl border border-gray-100 bg-white p-4 active:bg-gray-50"
        onClick={onEdit}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onEdit();
          }
        }}
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs text-gray-400">{record.formNumber || 'No form #'}</span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusClass}`}>
            {record.syncStatus}
          </span>
        </div>

        <p className="truncate text-lg font-semibold text-gray-800">
          {record.fullName || 'Unnamed'}
        </p>

        {record.fatherHusbandName && (
          <p className="text-sm text-gray-500">{record.fatherHusbandName}</p>
        )}

        {record.cnicNumber && (
          <p className="font-mono text-sm text-gray-500">{record.cnicNumber}</p>
        )}

        {locationParts && <p className="mt-1 text-xs text-gray-400">{locationParts}</p>}

        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-gray-400">{timeAgo(record.createdAt)}</span>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onEdit();
              }}
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              aria-label="Edit"
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                <path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>

            {onRetry && isOnline && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onRetry();
                }}
                className="rounded-lg p-2 text-amber-600 hover:bg-amber-50"
                aria-label="Retry sync"
              >
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 4v6h6M23 20v-6h-6" />
                  <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" />
                </svg>
              </button>
            )}

            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onDelete();
              }}
              className="rounded-lg p-2 text-red-500 hover:bg-red-50"
              aria-label="Delete"
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {record.syncError && (
        <p className="mt-1 px-1 text-xs text-red-600">
          ⚠️ {record.syncError.length > 60
            ? `${record.syncError.slice(0, 60)}...`
            : record.syncError}
        </p>
      )}
    </div>
  );
}

export default function RecordsPage() {
  const router = useRouter();
  const { isOnline } = useOnlineStatus();
  const [allRecords, setAllRecords] = useState([]);
  const [filteredRecords, setFilteredRecords] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = useCallback((message, type) => {
    setToastMessage({ message, type });
    setTimeout(() => setToastMessage(null), 3000);
  }, []);

  const loadRecords = useCallback(async () => {
    const records = await getAllRecords();
    setAllRecords(records);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (router.isReady && router.query.filter) {
      setActiveFilter(String(router.query.filter));
    }
  }, [router.isReady, router.query.filter]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  useEffect(() => {
    let result = [...allRecords];

    if (activeFilter !== 'all') {
      result = result.filter((record) => record.syncStatus === activeFilter);
    }

    if (searchQuery.trim().length > 0) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(
        (record) =>
          (record.fullName || '').toLowerCase().includes(query) ||
          (record.cnicNumber || '').toLowerCase().includes(query) ||
          (record.formNumber || '').toLowerCase().includes(query) ||
          (record.addressCity || '').toLowerCase().includes(query) ||
          (record.city || '').toLowerCase().includes(query) ||
          (record.mobileNumber || '').toLowerCase().includes(query)
      );
    }

    setFilteredRecords(result);
  }, [allRecords, searchQuery, activeFilter]);

  const counts = {
    all: allRecords.length,
    pending: allRecords.filter((record) => record.syncStatus === 'pending').length,
    synced: allRecords.filter((record) => record.syncStatus === 'synced').length,
    failed: allRecords.filter((record) => record.syncStatus === 'failed').length,
    draft: allRecords.filter((record) => record.syncStatus === 'draft').length,
  };

  const handleDelete = async (id) => {
    await deleteRecord(id);
    setAllRecords((prev) => prev.filter((record) => record.id !== id));
    setDeleteConfirm(null);
    showToast('Record deleted', 'info');
  };

  const handleSyncPending = async () => {
    setIsSyncing(true);
    const result = await syncPendingRecords();
    const updated = await getAllRecords();
    setAllRecords(updated);
    setIsSyncing(false);

    if (result.synced > 0) {
      showToast(`Synced ${result.synced} records`, 'success');
    }
    if (result.failed > 0) {
      showToast(`${result.failed} records failed`, 'error');
    }
  };

  const handleRetryFailed = async () => {
    setIsSyncing(true);
    await retryFailedRecords();
    const updated = await getAllRecords();
    setAllRecords(updated);
    setIsSyncing(false);
    showToast('Retrying failed records...', 'info');
  };

  return (
    <>
      <Head>
        <title>Records | PM E-Fan Data Collection</title>
      </Head>

      <Layout title="Records">
        <div className="flex h-full flex-col">
          <div className="sticky top-0 z-10 bg-gray-50 px-4 pb-2 pt-4">
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <input
                type="search"
                placeholder="Search by name, CNIC, city..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-9 pr-4 text-base focus:outline-none focus:ring-2 focus:ring-primary-600"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-lg text-gray-400"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          <div className="scrollbar-hide overflow-x-auto bg-gray-50 px-4 pb-2">
            <div className="flex min-w-max gap-2">
              {['all', 'pending', 'synced', 'failed', 'draft'].map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setActiveFilter(filter)}
                  className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                    activeFilter === filter
                      ? 'bg-primary-600 text-white'
                      : 'border border-gray-200 bg-white text-gray-600'
                  }`}
                >
                  {filter.charAt(0).toUpperCase() + filter.slice(1)}
                  <span className="ml-1.5 text-xs opacity-75">({counts[filter]})</span>
                </button>
              ))}
            </div>
          </div>

          {activeFilter === 'pending' && counts.pending > 0 && (
            <div className="flex items-center justify-between border-b border-amber-100 bg-amber-50 px-4 py-2">
              <span className="text-sm text-amber-700">
                {counts.pending} records ready to sync
              </span>
              <button
                type="button"
                onClick={handleSyncPending}
                disabled={isSyncing || !isOnline}
                className="flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-1.5 text-sm text-white disabled:opacity-50"
              >
                {isSyncing ? '⏳ Syncing...' : '☁️ Sync All'}
              </button>
            </div>
          )}

          {activeFilter === 'failed' && counts.failed > 0 && (
            <div className="flex items-center justify-between border-b border-red-100 bg-red-50 px-4 py-2">
              <span className="text-sm text-red-700">{counts.failed} records failed to sync</span>
              <button
                type="button"
                onClick={handleRetryFailed}
                disabled={isSyncing || !isOnline}
                className="rounded-lg bg-red-500 px-3 py-1.5 text-sm text-white disabled:opacity-50"
              >
                {isSyncing ? '⏳ Retrying...' : '🔄 Retry All'}
              </button>
            </div>
          )}

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={index}
                  className="animate-pulse rounded-xl border border-gray-100 bg-white p-4"
                >
                  <div className="mb-2 h-4 w-3/4 rounded bg-gray-200" />
                  <div className="mb-2 h-3 w-1/2 rounded bg-gray-100" />
                  <div className="h-3 w-2/3 rounded bg-gray-100" />
                </div>
              ))
            ) : filteredRecords.length === 0 ? (
              <div className="py-16 text-center">
                <div className="mb-3 text-4xl">{searchQuery ? '🔍' : '📭'}</div>
                <p className="text-sm text-gray-500">
                  {searchQuery
                    ? `No records match "${searchQuery}"`
                    : activeFilter === 'all'
                      ? 'No records yet. Start filling forms!'
                      : `No ${activeFilter} records`}
                </p>
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="mt-3 text-sm text-primary-600 underline"
                  >
                    Clear search
                  </button>
                )}
              </div>
            ) : (
              filteredRecords.map((record) => (
                <RecordCard
                  key={record.id}
                  record={record}
                  onEdit={() => router.push(`/form?id=${record.id}`)}
                  onDelete={() => setDeleteConfirm(record.id)}
                  onRetry={
                    record.syncStatus === 'failed'
                      ? async () => {
                          await updateRecord(record.id, {
                            syncStatus: 'pending',
                            syncError: null,
                          });
                          const updated = await getAllRecords();
                          setAllRecords(updated);
                          showToast('Marked for retry', 'info');
                        }
                      : null
                  }
                  isOnline={isOnline}
                />
              ))
            )}

            {!isLoading && filteredRecords.length > 0 && (
              <p className="py-2 text-center text-xs text-gray-400">
                Showing {filteredRecords.length} of {allRecords.length} records
              </p>
            )}
          </div>
        </div>

        {deleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
              <h3 className="mb-2 text-lg font-bold text-gray-800">Delete Record?</h3>
              <p className="mb-6 text-sm text-gray-600">
                This record will be permanently deleted from this device.
                {allRecords.find((record) => record.id === deleteConfirm)?.syncStatus ===
                'synced'
                  ? ' It has already been synced to Google Sheets.'
                  : ' It has NOT been synced yet and will be lost.'}
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(null)}
                  className="btn-secondary flex-1 py-3"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(deleteConfirm)}
                  className="btn-danger flex-1 py-3"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {toastMessage && (
          <div
            className={`fixed bottom-24 left-4 right-4 z-50 rounded-xl px-4 py-3 text-center text-sm font-medium text-white shadow-lg ${
              toastMessage.type === 'success'
                ? 'bg-green-600'
                : toastMessage.type === 'error'
                  ? 'bg-red-600'
                  : toastMessage.type === 'warning'
                    ? 'bg-amber-500'
                    : 'bg-gray-800'
            }`}
          >
            {toastMessage.message}
          </div>
        )}
      </Layout>
    </>
  );
}
