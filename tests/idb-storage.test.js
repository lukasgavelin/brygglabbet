import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isIdbSupported,
  openDatabase,
  idbSet,
  idbGet,
  idbGetAll,
  idbDelete,
  idbClear,
  getAllBatchesFromIDB,
  saveBatchToIDB,
  saveAllBatchesToIDB,
  deleteBatchFromIDB,
  migrateBatchesFromLocalStorage,
  DB_NAME,
  STORES,
} from '../src/core/idbStorage.js';
import { safeStorage } from '../src/core/storage.js';

describe('IndexedDB Storage & Batches Migration (idbStorage.js)', () => {
  let mockStores;

  function createMockIDB() {
    mockStores = {
      batches: new Map(),
      kv: new Map(),
    };

    return {
      open: vi.fn((_name, _version) => {
        const req = {
          result: {
            objectStoreNames: {
              contains: (storeName) => Boolean(mockStores[storeName]),
            },
            createObjectStore: vi.fn((storeName) => {
              mockStores[storeName] = new Map();
            }),
            transaction: vi.fn((storeName, _mode) => {
              const currentStore = mockStores[storeName] || new Map();
              const tx = {
                objectStore: vi.fn(() => ({
                  get: vi.fn((key) => {
                    const r = { result: currentStore.get(key) || null };
                    setTimeout(() => r.onsuccess?.({ target: r }), 0);
                    return r;
                  }),
                  getAll: vi.fn(() => {
                    const r = { result: Array.from(currentStore.values()) };
                    setTimeout(() => r.onsuccess?.({ target: r }), 0);
                    return r;
                  }),
                  put: vi.fn((val) => {
                    const key = val.id || val.key;
                    currentStore.set(key, val);
                    const r = { result: key };
                    setTimeout(() => r.onsuccess?.({ target: r }), 0);
                    return r;
                  }),
                  delete: vi.fn((key) => {
                    currentStore.delete(key);
                    const r = {};
                    setTimeout(() => r.onsuccess?.({ target: r }), 0);
                    return r;
                  }),
                  clear: vi.fn(() => {
                    currentStore.clear();
                    const r = {};
                    setTimeout(() => r.onsuccess?.({ target: r }), 0);
                    return r;
                  }),
                })),
                oncomplete: null,
                onerror: null,
              };
              setTimeout(() => tx.oncomplete?.(), 0);
              return tx;
            }),
          },
          onsuccess: null,
          onerror: null,
          onupgradeneeded: null,
        };

        setTimeout(() => {
          if (req.onupgradeneeded) {
            req.onupgradeneeded({ target: req });
          }
          if (req.onsuccess) {
            req.onsuccess({ target: req });
          }
        }, 0);

        return req;
      }),
    };
  }

  beforeEach(() => {
    localStorage.clear();
    window.indexedDB = createMockIDB();
  });

  afterEach(() => {
    delete window.indexedDB;
    vi.restoreAllMocks();
  });

  describe('isIdbSupported', () => {
    it('returnerar true när indexedDB finns tillgängligt', () => {
      expect(isIdbSupported()).toBe(true);
    });

    it('returnerar false när window.indexedDB är null eller saknas', () => {
      delete window.indexedDB;
      expect(isIdbSupported()).toBe(false);
    });
  });

  describe('CRUD operationer', () => {
    it('öppnar databasen och initierar stores', async () => {
      const db = await openDatabase();
      expect(db).toBeDefined();
      expect(window.indexedDB.open).toHaveBeenCalledWith(DB_NAME, 1);
    });

    it('sparar, hämtar och raderar data i kv-store', async () => {
      await idbSet(STORES.KV, { key: 'theme', value: 'dark' });
      const record = await idbGet(STORES.KV, 'theme');
      expect(record).toEqual({ key: 'theme', value: 'dark' });

      await idbDelete(STORES.KV, 'theme');
      const deleted = await idbGet(STORES.KV, 'theme');
      expect(deleted).toBeNull();
    });

    it('idbGetAll hämtar alla objekt och idbClear tömmer storen', async () => {
      await idbSet(STORES.KV, { key: 'item1', val: 1 });
      await idbSet(STORES.KV, { key: 'item2', val: 2 });

      const all = await idbGetAll(STORES.KV);
      expect(all).toHaveLength(2);

      await idbClear(STORES.KV);
      const afterClear = await idbGetAll(STORES.KV);
      expect(afterClear).toHaveLength(0);
    });
  });

  describe('Batches Hantering & Migration', () => {
    const sampleBatches = [
      { id: 'batch-1', recipeName: 'Stigbergets Clone IPA', brewDate: '2026-11-01' },
      { id: 'batch-2', recipeName: 'Kallkraschad Lager', brewDate: '2026-11-05' },
    ];

    it('sparar och hämtar batcher via saveBatchToIDB och getAllBatchesFromIDB', async () => {
      await saveBatchToIDB(sampleBatches[0]);
      await saveBatchToIDB(sampleBatches[1]);

      const batches = await getAllBatchesFromIDB();
      expect(batches).toHaveLength(2);
      expect(batches.map((b) => b.id)).toContain('batch-1');
      expect(batches.map((b) => b.id)).toContain('batch-2');
    });

    it('saveAllBatchesToIDB sparar en hel lista i en transaktion', async () => {
      await saveAllBatchesToIDB(sampleBatches);
      const batches = await getAllBatchesFromIDB();
      expect(batches).toHaveLength(2);
    });

    it('deleteBatchFromIDB raderar en batch baserat på ID', async () => {
      await saveAllBatchesToIDB(sampleBatches);
      await deleteBatchFromIDB('batch-1');

      const remaining = await getAllBatchesFromIDB();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe('batch-2');
    });

    it('migrerar befintliga batcher transparent från localStorage till IndexedDB', async () => {
      // Skapa gamla batcher i localStorage
      safeStorage.setJSON('brygglabbet_batches', sampleBatches);

      const result = await migrateBatchesFromLocalStorage('brygglabbet_batches');
      expect(result.migrated).toBe(true);
      expect(result.count).toBe(2);

      // Verifiera att de finns i IDB
      const idbBatches = await getAllBatchesFromIDB();
      expect(idbBatches).toHaveLength(2);

      // Verifiera att migreringsflaggan har satts
      expect(safeStorage.getItem('brygglabbet_idb_migrated_v1')).toBe('true');

      // Ett andra anrop ska inte migrera på nytt
      const secondRun = await migrateBatchesFromLocalStorage('brygglabbet_batches');
      expect(secondRun.migrated).toBe(false);
      expect(secondRun.count).toBe(0);
    });
  });
});
