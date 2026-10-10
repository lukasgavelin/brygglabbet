/**
 * Safe LocalStorage and SessionStorage wrapper module.
 * Provides quota-exceeded protection, in-memory fallback when storage is blocked,
 * and callbacks for storage notifications.
 */

const memoryStore = new Map();
let onQuotaExceededCallback = null;

/**
 * Checks whether storage of the given type is available and writable.
 * @param {'localStorage'|'sessionStorage'} [type='localStorage']
 * @returns {boolean}
 */
export function isStorageAvailable(type = 'localStorage') {
  try {
    if (typeof window === 'undefined' || !window[type]) return false;
    const storage = window[type];
    const testKey = '__brygglabbet_storage_test__';
    storage.setItem(testKey, '1');
    storage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Registers a callback for when storage quota is exceeded.
 * @param {Function} cb - (error: Error, key: string) => void
 */
export function onQuotaExceeded(cb) {
  onQuotaExceededCallback = cb;
}

export const safeStorage = {
  /**
   * Retrieves an item from localStorage (or in-memory fallback).
   * @param {string} key
   * @param {string|null} [fallback=null]
   * @returns {string|null}
   */
  getItem(key, fallback = null) {
    try {
      if (typeof localStorage !== 'undefined') {
        const val = localStorage.getItem(key);
        if (val !== null) return val;
        if (memoryStore.has(key)) return memoryStore.get(key);
        return fallback;
      }
    } catch (err) {
      console.warn(`[safeStorage] Kunde inte läsa "${key}" från localStorage:`, err);
    }
    return memoryStore.has(key) ? memoryStore.get(key) : fallback;
  },

  /**
   * Safely writes an item to localStorage.
   * Catches QuotaExceededError and notifies listeners without throwing.
   * @param {string} key
   * @param {string} value
   * @returns {boolean} Success status
   */
  setItem(key, value) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, value);
        memoryStore.delete(key);
        return true;
      }
    } catch (err) {
      console.warn(`[safeStorage] Kunde inte skriva "${key}" till localStorage:`, err);
      memoryStore.set(key, value);
      const isQuota =
        err.name === 'QuotaExceededError' ||
        err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
        err.code === 22 ||
        err.code === 1014;
      if (isQuota && typeof onQuotaExceededCallback === 'function') {
        onQuotaExceededCallback(err, key);
      }
      return false;
    }
    memoryStore.set(key, value);
    return true;
  },

  /**
   * Removes an item from localStorage and memory fallback.
   * @param {string} key
   */
  removeItem(key) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
      }
    } catch (err) {
      console.warn(`[safeStorage] Kunde inte radera "${key}" från localStorage:`, err);
    }
    memoryStore.delete(key);
  },

  /**
   * Clears all items from storage and memory fallback.
   */
  clear() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.clear();
      }
    } catch {
      // ignore
    }
    memoryStore.clear();
  },

  /**
   * Safely retrieves and JSON-parses an item.
   * @param {string} key
   * @param {*} [fallback=null]
   * @returns {*}
   */
  getJSON(key, fallback = null) {
    const raw = this.getItem(key, null);
    if (raw === null || raw === undefined) return fallback;
    try {
      return JSON.parse(raw);
    } catch (err) {
      console.warn(`[safeStorage] JSON-tolkningsfel för "${key}":`, err);
      return fallback;
    }
  },

  /**
   * Safely JSON-stringifies and writes an item.
   * @param {string} key
   * @param {*} value
   * @returns {boolean}
   */
  setJSON(key, value) {
    try {
      const stringified = JSON.stringify(value);
      return this.setItem(key, stringified);
    } catch (err) {
      console.warn(`[safeStorage] JSON-serialiseringsfel för "${key}":`, err);
      return false;
    }
  },
};

const sessionMemoryStore = new Map();

export const safeSessionStorage = {
  getItem(key, fallback = null) {
    try {
      if (typeof sessionStorage !== 'undefined') {
        const val = sessionStorage.getItem(key);
        if (val !== null) return val;
        if (sessionMemoryStore.has(key)) return sessionMemoryStore.get(key);
        return fallback;
      }
    } catch {
      // ignore
    }
    return sessionMemoryStore.has(key) ? sessionMemoryStore.get(key) : fallback;
  },

  setItem(key, value) {
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(key, value);
        sessionMemoryStore.delete(key);
        return true;
      }
    } catch {
      // ignore
    }
    sessionMemoryStore.set(key, value);
    return true;
  },

  removeItem(key) {
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem(key);
      }
    } catch {
      // ignore
    }
    sessionMemoryStore.delete(key);
  },

  clear() {
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.clear();
      }
    } catch {
      // ignore
    }
    sessionMemoryStore.clear();
  },

  getJSON(key, fallback = null) {
    const raw = this.getItem(key, null);
    if (!raw) return fallback;
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  },

  setJSON(key, value) {
    try {
      return this.setItem(key, JSON.stringify(value));
    } catch {
      return false;
    }
  },
};
