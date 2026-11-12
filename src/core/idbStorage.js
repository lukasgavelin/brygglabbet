/**
 * IndexedDB Storage Layer for Brygglabbet.
 * Provides high-capacity asynchronous persistence for batches, telemetry logs (Tilt Hydrometer),
 * and recipe archives beyond localStorage's 5 MB quota boundary.
 */

import { safeStorage } from './storage.js';

export const DB_NAME = 'brygglabbet_db';
export const DB_VERSION = 1;
export const STORES = {
  BATCHES: 'batches',
  KV: 'kv',
};

const MIGRATION_FLAG_KEY = 'brygglabbet_idb_migrated_v1';

/**
 * Checks whether IndexedDB is available and usable in the current environment.
 * @returns {boolean}
 */
export function isIdbSupported() {
  try {
    return (
      typeof window !== 'undefined' &&
      'indexedDB' in window &&
      window.indexedDB !== null &&
      typeof window.indexedDB.open === 'function'
    );
  } catch {
    return false;
  }
}

/**
 * Opens or upgrades the Brygglabbet IndexedDB database.
 * @returns {Promise<IDBDatabase>}
 */
export function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!isIdbSupported()) {
      return reject(new Error('IndexedDB stöds inte i denna miljö.'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Batches store (indexed by unique id)
      if (!db.objectStoreNames.contains(STORES.BATCHES)) {
        db.createObjectStore(STORES.BATCHES, { keyPath: 'id' });
      }

      // Key-Value store for arbitrary larger objects
      if (!db.objectStoreNames.contains(STORES.KV)) {
        db.createObjectStore(STORES.KV, { keyPath: 'key' });
      }
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      reject(event.target.error || new Error('Kunde inte öppna IndexedDB.'));
    };
  });
}

/**
 * Retrieves a single record from an object store by key.
 * @param {string} storeName
 * @param {string|number} key
 * @returns {Promise<any>}
 */
export async function idbGet(storeName, key) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.get(key);

    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Retrieves all records from an object store.
 * @param {string} storeName
 * @returns {Promise<Array<any>>}
 */
export async function idbGetAll(storeName) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();

    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Inserts or updates a record in an object store.
 * @param {string} storeName
 * @param {object} value
 * @returns {Promise<any>}
 */
export async function idbSet(storeName, value) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.put(value);

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Deletes a record from an object store.
 * @param {string} storeName
 * @param {string|number} key
 * @returns {Promise<boolean>}
 */
export async function idbDelete(storeName, key) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.delete(key);

    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Clears all records from an object store.
 * @param {string} storeName
 * @returns {Promise<boolean>}
 */
export async function idbClear(storeName) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.clear();

    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

/* =========================================================================
   High-Level Batches IndexedDB API
   ========================================================================= */

/**
 * Fetches all batches stored in IndexedDB.
 * @returns {Promise<Array<object>>}
 */
export async function getAllBatchesFromIDB() {
  if (!isIdbSupported()) return [];
  try {
    return await idbGetAll(STORES.BATCHES);
  } catch (err) {
    console.warn('[idbStorage] Kunde inte hämta batcher från IndexedDB:', err);
    return [];
  }
}

/**
 * Saves a single batch to IndexedDB.
 * @param {object} batch
 * @returns {Promise<boolean>}
 */
export async function saveBatchToIDB(batch) {
  if (!isIdbSupported() || !batch || !batch.id) return false;
  try {
    await idbSet(STORES.BATCHES, batch);
    return true;
  } catch (err) {
    console.warn('[idbStorage] Kunde inte spara batch till IndexedDB:', err);
    return false;
  }
}

/**
 * Persists an array of batches to IndexedDB in a single transaction.
 * @param {Array<object>} batches
 * @returns {Promise<boolean>}
 */
export async function saveAllBatchesToIDB(batches) {
  if (!isIdbSupported() || !Array.isArray(batches)) return false;
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.BATCHES, 'readwrite');
      const store = tx.objectStore(STORES.BATCHES);

      batches.forEach((b) => {
        if (b && b.id) store.put(b);
      });

      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[idbStorage] Kunde inte spara batcher till IndexedDB:', err);
    return false;
  }
}

/**
 * Deletes a batch from IndexedDB.
 * @param {string} id
 * @returns {Promise<boolean>}
 */
export async function deleteBatchFromIDB(id) {
  if (!isIdbSupported() || !id) return false;
  try {
    await idbDelete(STORES.BATCHES, id);
    return true;
  } catch (err) {
    console.warn('[idbStorage] Kunde inte radera batch från IndexedDB:', err);
    return false;
  }
}

/**
 * Performs a transparent one-time migration of existing batches in localStorage
 * to IndexedDB on application boot.
 * @param {string} [localStorageKey='brygglabbet_batches']
 * @returns {Promise<{ migrated: boolean, count: number }>}
 */
export async function migrateBatchesFromLocalStorage(localStorageKey = 'brygglabbet_batches') {
  if (!isIdbSupported()) {
    return { migrated: false, count: 0 };
  }

  const alreadyMigrated = safeStorage.getItem(MIGRATION_FLAG_KEY);
  if (alreadyMigrated === 'true') {
    return { migrated: false, count: 0 };
  }

  try {
    const rawBatches = safeStorage.getJSON(localStorageKey, []);
    if (Array.isArray(rawBatches) && rawBatches.length > 0) {
      await saveAllBatchesToIDB(rawBatches);
      safeStorage.setItem(MIGRATION_FLAG_KEY, 'true');
      return { migrated: true, count: rawBatches.length };
    }
    // Mark as migrated even if empty so we don't recheck
    safeStorage.setItem(MIGRATION_FLAG_KEY, 'true');
    return { migrated: false, count: 0 };
  } catch (err) {
    console.warn('[idbStorage] Fel vid migrering från localStorage:', err);
    return { migrated: false, count: 0 };
  }
}
