import {
  getRecordsByStatus,
  updateRecord,
  addSyncLog,
  getPendingCount,
  saveSetting,
  getSetting,
} from './db';

let isSyncInProgress = false;

export const getSyncInProgress = () => isSyncInProgress;

export async function syncPendingRecords() {
  if (isSyncInProgress) {
    console.log('Sync already in progress, skipping');
    return { skipped: true };
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    console.log('Offline, skipping sync');
    return { skipped: true, reason: 'offline' };
  }

  isSyncInProgress = true;

  const startTime = Date.now();
  let totalSynced = 0;
  let totalFailed = 0;

  try {
    const pendingRecords = await getRecordsByStatus('pending');

    if (pendingRecords.length === 0) {
      return { synced: 0, failed: 0, total: 0 };
    }

    console.log(`Starting sync of ${pendingRecords.length} records`);

    const agentEmail = (await getSetting('agentEmail')) || '';

    const response = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        records: pendingRecords,
        agentEmail,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Server error ${response.status}: ${errorText}`);
    }

    const result = await response.json();

    if (result.syncedIds && result.syncedIds.length > 0) {
      const syncedAt = new Date().toISOString();
      for (const id of result.syncedIds) {
        await updateRecord(id, {
          syncStatus: 'synced',
          syncedAt,
          syncError: null,
        });
      }
      totalSynced = result.syncedIds.length;
    }

    if (result.failedIds && result.failedIds.length > 0) {
      const errorMsg = result.errors?.[0] || 'Sync failed';
      for (const id of result.failedIds) {
        await updateRecord(id, {
          syncStatus: 'failed',
          syncError: errorMsg,
        });
      }
      totalFailed = result.failedIds.length;
    }

    await addSyncLog({
      timestamp: new Date().toISOString(),
      status: totalFailed === 0 ? 'success' : totalSynced > 0 ? 'partial' : 'failed',
      totalRecords: pendingRecords.length,
      syncedCount: totalSynced,
      failedCount: totalFailed,
      errorDetails: result.errors?.join('; ') || null,
    });

    await saveSetting('lastSyncTime', new Date().toISOString());
    await saveSetting(
      'lastSyncStats',
      JSON.stringify({
        synced: totalSynced,
        failed: totalFailed,
        total: pendingRecords.length,
        time: new Date().toISOString(),
      })
    );

    console.log(`Sync complete: ${totalSynced} synced, ${totalFailed} failed`);

    return {
      synced: totalSynced,
      failed: totalFailed,
      total: pendingRecords.length,
    };
  } catch (error) {
    console.error('Sync error:', error);

    try {
      const pendingRecords = await getRecordsByStatus('pending');
      for (const record of pendingRecords) {
        await updateRecord(record.id, {
          syncStatus: 'failed',
          syncError: error.message,
        });
      }
      totalFailed = pendingRecords.length;
    } catch (dbError) {
      console.error('Error updating failed records:', dbError);
    }

    await addSyncLog({
      timestamp: new Date().toISOString(),
      status: 'failed',
      totalRecords: 0,
      syncedCount: 0,
      failedCount: totalFailed,
      errorDetails: error.message,
    }).catch(() => {});

    return { synced: 0, failed: totalFailed, error: error.message };
  } finally {
    isSyncInProgress = false;
  }
}

export async function retryFailedRecords() {
  const failedRecords = await getRecordsByStatus('failed');

  if (failedRecords.length === 0) {
    return { message: 'No failed records to retry' };
  }

  for (const record of failedRecords) {
    await updateRecord(record.id, {
      syncStatus: 'pending',
      syncError: null,
    });
  }

  console.log(`Reset ${failedRecords.length} failed records to pending`);

  return syncPendingRecords();
}

export function setupAutoSync() {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleOnline = () => {
    console.log('Back online, scheduling sync...');
    setTimeout(() => {
      syncPendingRecords();
    }, 5000);
  };

  window.addEventListener('online', handleOnline);

  const intervalId = setInterval(() => {
    if (navigator.onLine) {
      getPendingCount().then((count) => {
        if (count > 0) {
          syncPendingRecords();
        }
      });
    }
  }, 5 * 60 * 1000);

  return () => {
    window.removeEventListener('online', handleOnline);
    clearInterval(intervalId);
  };
}

export async function syncSingleRecord(recordId) {
  await updateRecord(recordId, { syncStatus: 'pending', syncError: null });
  return syncPendingRecords();
}
