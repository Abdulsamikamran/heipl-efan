import { openDB } from 'idb';
import { generateUUID } from './utils';

const DB_NAME = 'efan_db';
const DB_VERSION = 2;

const STORES = {
  RECORDS: 'records',
  AUTOCOMPLETE: 'autocomplete_cache',
  SETTINGS: 'agent_settings',
  SYNC_LOG: 'sync_log',
  PHOTOS: 'photos',
};

const PHOTO_TYPE_ORDER = ['consumer', 'cnicFront', 'cnicBack', 'bill'];

let dbPromise = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (!db.objectStoreNames.contains(STORES.RECORDS)) {
          const recordsStore = db.createObjectStore(STORES.RECORDS, { keyPath: 'id' });
          recordsStore.createIndex('syncStatus', 'syncStatus', { unique: false });
          recordsStore.createIndex('createdAt', 'createdAt', { unique: false });
          recordsStore.createIndex('cnicNumber', 'cnicNumber', { unique: false });
          recordsStore.createIndex('city', 'city', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.AUTOCOMPLETE)) {
          const autocompleteStore = db.createObjectStore(STORES.AUTOCOMPLETE, {
            keyPath: 'id',
            autoIncrement: true,
          });
          autocompleteStore.createIndex('fieldName', 'fieldName', { unique: false });
          autocompleteStore.createIndex('fieldName_value', ['fieldName', 'value'], {
            unique: true,
          });
          autocompleteStore.createIndex('frequency', 'frequency', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
          db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
        }

        if (!db.objectStoreNames.contains(STORES.SYNC_LOG)) {
          const syncLogStore = db.createObjectStore(STORES.SYNC_LOG, {
            keyPath: 'id',
            autoIncrement: true,
          });
          syncLogStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        if (oldVersion < 2 && !db.objectStoreNames.contains(STORES.PHOTOS)) {
          const photosStore = db.createObjectStore(STORES.PHOTOS, {
            keyPath: 'id',
            autoIncrement: true,
          });
          photosStore.createIndex('recordId', 'recordId', { unique: false });
          photosStore.createIndex('recordId_type', ['recordId', 'type'], {
            unique: true,
          });
          photosStore.createIndex('uploaded', 'uploaded', { unique: false });
        }
      },
    });
  }

  return dbPromise;
}

export async function initDB() {
  try {
    return await getDB();
  } catch (error) {
    console.error('initDB error:', error);
    return null;
  }
}

export async function addRecord(recordObj) {
  try {
    const db = await getDB();
    const now = new Date().toISOString();
    const record = {
      id: recordObj.id || generateUUID(),
      syncStatus: recordObj.syncStatus || 'draft',
      syncError: recordObj.syncError || null,
      syncedAt: recordObj.syncedAt || null,
      createdAt: recordObj.createdAt || now,
      updatedAt: recordObj.updatedAt || now,
      ...recordObj,
    };

    await db.add(STORES.RECORDS, record);
    return record.id;
  } catch (error) {
    console.error('addRecord error:', error);
    return null;
  }
}

export async function updateRecord(id, updatesObj) {
  try {
    const db = await getDB();
    const existing = await db.get(STORES.RECORDS, id);

    if (!existing) {
      console.error('updateRecord error: record not found', id);
      return null;
    }

    const updated = {
      ...existing,
      ...updatesObj,
      id: existing.id,
      updatedAt: new Date().toISOString(),
    };

    await db.put(STORES.RECORDS, updated);
    return updated;
  } catch (error) {
    console.error('updateRecord error:', error);
    return null;
  }
}

export async function getRecord(id) {
  try {
    const db = await getDB();
    const record = await db.get(STORES.RECORDS, id);
    return record || null;
  } catch (error) {
    console.error('getRecord error:', error);
    return null;
  }
}

export async function getAllRecords() {
  try {
    const db = await getDB();
    const records = await db.getAll(STORES.RECORDS);
    return records.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } catch (error) {
    console.error('getAllRecords error:', error);
    return [];
  }
}

export async function getRecordsByStatus(status) {
  try {
    const db = await getDB();
    return await db.getAllFromIndex(STORES.RECORDS, 'syncStatus', status);
  } catch (error) {
    console.error('getRecordsByStatus error:', error);
    return [];
  }
}

export async function upsertSheetRecord(recordObj) {
  try {
    const db = await getDB();
    const existing = await db.get(STORES.RECORDS, recordObj.id);

    if (existing && ['draft', 'pending', 'failed'].includes(existing.syncStatus)) {
      return existing.id;
    }

    const now = new Date().toISOString();
    await db.put(STORES.RECORDS, {
      ...existing,
      ...recordObj,
      id: recordObj.id,
      createdAt: existing?.createdAt || recordObj.createdAt || now,
      updatedAt: recordObj.updatedAt || now,
    });
    return recordObj.id;
  } catch (error) {
    console.error('upsertSheetRecord error:', error);
    return null;
  }
}

export async function deleteRecord(id) {
  try {
    const db = await getDB();
    await db.delete(STORES.RECORDS, id);
    return true;
  } catch (error) {
    console.error('deleteRecord error:', error);
    return false;
  }
}

export async function getRecordCount() {
  try {
    const db = await getDB();
    return await db.count(STORES.RECORDS);
  } catch (error) {
    console.error('getRecordCount error:', error);
    return 0;
  }
}

export async function getPendingCount() {
  try {
    const db = await getDB();
    return await db.countFromIndex(STORES.RECORDS, 'syncStatus', 'pending');
  } catch (error) {
    console.error('getPendingCount error:', error);
    return 0;
  }
}

export async function getTodayCount() {
  try {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const records = await getAllRecords();
    return records.filter((record) => {
      if (!record.createdAt) return false;
      return record.createdAt.slice(0, 10) === todayStr;
    }).length;
  } catch (error) {
    console.error('getTodayCount error:', error);
    return 0;
  }
}

export async function searchRecords(query) {
  try {
    if (!query || !query.trim()) return [];

    const normalizedQuery = query.trim().toLowerCase();
    const records = await getAllRecords();

    return records.filter((record) => {
      const fields = [
        record.fullName,
        record.cnicNumber,
        record.formNumber,
        record.city,
      ];

      return fields.some((field) => {
        if (!field) return false;
        return String(field).toLowerCase().includes(normalizedQuery);
      });
    });
  } catch (error) {
    console.error('searchRecords error:', error);
    return [];
  }
}

export async function bulkUpdateStatus(idsArray, status) {
  try {
    const db = await getDB();
    const tx = db.transaction(STORES.RECORDS, 'readwrite');
    const store = tx.objectStore(STORES.RECORDS);
    const now = new Date().toISOString();

    await Promise.all(
      idsArray.map(async (id) => {
        const existing = await store.get(id);
        if (existing) {
          await store.put({
            ...existing,
            syncStatus: status,
            updatedAt: now,
          });
        }
      })
    );

    await tx.done;
    return true;
  } catch (error) {
    console.error('bulkUpdateStatus error:', error);
    return false;
  }
}

export async function addAutocompleteEntry(fieldName, value) {
  try {
    const trimmedValue = value ? String(value).trim() : '';
    if (!trimmedValue) return;

    const db = await getDB();
    const tx = db.transaction(STORES.AUTOCOMPLETE, 'readwrite');
    const store = tx.objectStore(STORES.AUTOCOMPLETE);
    const index = store.index('fieldName_value');
    const existing = await index.get([fieldName, trimmedValue]);
    const now = new Date().toISOString();

    if (existing) {
      await store.put({
        ...existing,
        frequency: (existing.frequency || 0) + 1,
        lastUsed: now,
      });
    } else {
      await store.add({
        fieldName,
        value: trimmedValue,
        frequency: 1,
        lastUsed: now,
      });
    }

    await tx.done;
  } catch (error) {
    console.error('addAutocompleteEntry error:', error);
  }
}

export async function getAutocompleteSuggestions(fieldName, query) {
  try {
    const db = await getDB();
    const allEntries = await db.getAllFromIndex(STORES.AUTOCOMPLETE, 'fieldName', fieldName);

    let filtered = allEntries;

    if (query && query.length >= 1) {
      const normalizedQuery = query.toLowerCase();
      filtered = allEntries.filter((entry) =>
        entry.value.toLowerCase().includes(normalizedQuery)
      );
    }

    return filtered
      .sort((a, b) => (b.frequency || 0) - (a.frequency || 0))
      .slice(0, 8)
      .map((entry) => entry.value);
  } catch (error) {
    console.error('getAutocompleteSuggestions error:', error);
    return [];
  }
}

export async function saveSetting(key, value) {
  try {
    const db = await getDB();
    await db.put(STORES.SETTINGS, { key, value });
    return true;
  } catch (error) {
    console.error('saveSetting error:', error);
    return false;
  }
}

export async function getSetting(key) {
  try {
    const db = await getDB();
    const setting = await db.get(STORES.SETTINGS, key);
    return setting ? setting.value : null;
  } catch (error) {
    console.error('getSetting error:', error);
    return null;
  }
}

export async function getAllSettings() {
  try {
    const db = await getDB();
    const settings = await db.getAll(STORES.SETTINGS);
    return settings.reduce((acc, item) => {
      acc[item.key] = item.value;
      return acc;
    }, {});
  } catch (error) {
    console.error('getAllSettings error:', error);
    return {};
  }
}

export async function addSyncLog(entry) {
  try {
    const db = await getDB();
    const logEntry = {
      timestamp: entry.timestamp || new Date().toISOString(),
      status: entry.status,
      totalRecords: entry.totalRecords,
      syncedCount: entry.syncedCount,
      failedCount: entry.failedCount,
      errorDetails: entry.errorDetails || null,
    };

    await db.add(STORES.SYNC_LOG, logEntry);
    return true;
  } catch (error) {
    console.error('addSyncLog error:', error);
    return false;
  }
}

export async function getRecentSyncLogs(limit = 10) {
  try {
    const db = await getDB();
    const logs = await db.getAllFromIndex(STORES.SYNC_LOG, 'timestamp');
    return logs
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  } catch (error) {
    console.error('getRecentSyncLogs error:', error);
    return [];
  }
}

export async function savePhoto(recordId, type, base64String) {
  try {
    const db = await getDB();
    const now = new Date().toISOString();
    const tx = db.transaction(STORES.PHOTOS, 'readwrite');
    const store = tx.objectStore(STORES.PHOTOS);
    const existing = await store.index('recordId_type').get([recordId, type]);

    if (existing) {
      await store.put({
        ...existing,
        base64: base64String,
        uploaded: false,
        driveFileId: null,
        driveUrl: null,
        uploadedAt: null,
      });
      await tx.done;
      return existing.id;
    }

    const id = await store.add({
      recordId,
      type,
      base64: base64String,
      driveFileId: null,
      driveUrl: null,
      uploaded: false,
      uploadedAt: null,
      createdAt: now,
    });
    await tx.done;
    return id;
  } catch (error) {
    console.error('savePhoto error:', error);
    return null;
  }
}

export async function getPhotosForRecord(recordId) {
  try {
    const db = await getDB();
    const photos = await db.getAllFromIndex(STORES.PHOTOS, 'recordId', recordId);
    return photos.sort(
      (a, b) => PHOTO_TYPE_ORDER.indexOf(a.type) - PHOTO_TYPE_ORDER.indexOf(b.type),
    );
  } catch (error) {
    console.error('getPhotosForRecord error:', error);
    return [];
  }
}

export async function getPhoto(recordId, type) {
  try {
    const db = await getDB();
    const photo = await db
      .transaction(STORES.PHOTOS)
      .store.index('recordId_type')
      .get([recordId, type]);
    return photo || null;
  } catch (error) {
    console.error('getPhoto error:', error);
    return null;
  }
}

export async function deletePhoto(recordId, type) {
  try {
    const db = await getDB();
    const photo = await db
      .transaction(STORES.PHOTOS, 'readwrite')
      .store.index('recordId_type')
      .get([recordId, type]);

    if (photo) {
      await db.delete(STORES.PHOTOS, photo.id);
    }
    return true;
  } catch (error) {
    console.error('deletePhoto error:', error);
    return false;
  }
}

export async function getUnuploadedPhotos() {
  try {
    const db = await getDB();
    const photos = await db.getAll(STORES.PHOTOS);
    return photos.filter((photo) => !photo.uploaded);
  } catch (error) {
    console.error('getUnuploadedPhotos error:', error);
    return [];
  }
}

export async function markPhotoUploaded(photoId, driveFileId, driveUrl) {
  try {
    const db = await getDB();
    const existing = await db.get(STORES.PHOTOS, photoId);

    if (!existing) {
      console.error('markPhotoUploaded error: photo not found', photoId);
      return false;
    }

    await db.put(STORES.PHOTOS, {
      ...existing,
      uploaded: true,
      driveFileId,
      driveUrl,
      uploadedAt: new Date().toISOString(),
    });
    return true;
  } catch (error) {
    console.error('markPhotoUploaded error:', error);
    return false;
  }
}

export async function deletePhotosForRecord(recordId) {
  try {
    const db = await getDB();
    const photos = await db.getAllFromIndex(STORES.PHOTOS, 'recordId', recordId);
    const tx = db.transaction(STORES.PHOTOS, 'readwrite');

    await Promise.all(photos.map((photo) => tx.store.delete(photo.id)));
    await tx.done;
    return true;
  } catch (error) {
    console.error('deletePhotosForRecord error:', error);
    return false;
  }
}
