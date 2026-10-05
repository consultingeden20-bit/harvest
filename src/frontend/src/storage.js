// PC Bastos Harvest Management System
// Offline-First IndexedDB Storage Engine & Outbox Manager

class OfflineStorage {
  constructor() {
    this.dbName = 'harvest_offline_db';
    this.dbVersion = 1;
    this.db = null;
  }

  async init() {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Master cache stores
        if (!db.objectStoreNames.contains('contributors')) {
          const store = db.createObjectStore('contributors', { keyPath: 'id' });
          store.createIndex('code', 'code', { unique: true });
          store.createIndex('name', 'name', { unique: false });
        }
        if (!db.objectStoreNames.contains('sessions')) {
          db.createObjectStore('sessions', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('categories')) {
          db.createObjectStore('categories', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('groups')) {
          db.createObjectStore('groups', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('income_sources')) {
          db.createObjectStore('income_sources', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('payment_methods')) {
          db.createObjectStore('payment_methods', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('garden_products')) {
          db.createObjectStore('garden_products', { keyPath: 'id' });
        }

        // Outbox queues for offline sync
        if (!db.objectStoreNames.contains('outbox_transactions')) {
          db.createObjectStore('outbox_transactions', { keyPath: 'client_tx_id' });
        }
        if (!db.objectStoreNames.contains('outbox_garden_sales')) {
          db.createObjectStore('outbox_garden_sales', { keyPath: 'client_sale_id' });
        }
        if (!db.objectStoreNames.contains('outbox_contributors')) {
          db.createObjectStore('outbox_contributors', { keyPath: 'id' });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('IndexedDB init error:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  async cacheMasterData(bundle) {
    await this.init();
    const stores = ['sessions', 'categories', 'groups', 'income_sources', 'payment_methods', 'garden_products', 'contributors'];

    for (const storeName of stores) {
      if (bundle[storeName] && Array.isArray(bundle[storeName])) {
        const tx = this.db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        store.clear();
        for (const item of bundle[storeName]) {
          store.put(item);
        }
      }
    }
    localStorage.setItem('harvest_last_cache_time', new Date().toISOString());
  }

  async getCachedContributors(search = '') {
    await this.init();
    return new Promise((resolve) => {
      const tx = this.db.transaction('contributors', 'readonly');
      const store = tx.objectStore('contributors');
      const req = store.getAll();

      req.onsuccess = () => {
        let items = req.result || [];
        if (search && search.trim()) {
          const q = search.trim().toLowerCase();
          items = items.filter(c => 
            (c.name && c.name.toLowerCase().includes(q)) ||
            (c.code && c.code.toLowerCase().includes(q)) ||
            (c.phone && c.phone.toLowerCase().includes(q))
          );
        }
        resolve(items);
      };
      req.onerror = () => resolve([]);
    });
  }

  async queueOfflineTransaction(txData) {
    await this.init();
    const tx = this.db.transaction('outbox_transactions', 'readwrite');
    const store = tx.objectStore('outbox_transactions');
    store.put(txData);

    // Also update local cached contributor balance optimistically
    if (txData.contributor_id) {
      const cTx = this.db.transaction('contributors', 'readwrite');
      const cStore = cTx.objectStore('contributors');
      const getReq = cStore.get(txData.contributor_id);
      getReq.onsuccess = () => {
        if (getReq.result) {
          const c = getReq.result;
          c.total_paid = (Number(c.total_paid) || 0) + Number(txData.amount);
          c.balance = Math.max(0, (Number(c.target_amount) || 0) - c.total_paid);
          cStore.put(c);
        }
      };
    }
  }

  async queueOfflineGardenSale(saleData) {
    await this.init();
    const tx = this.db.transaction('outbox_garden_sales', 'readwrite');
    const store = tx.objectStore('outbox_garden_sales');
    store.put(saleData);
  }

  async getPendingOutbox() {
    await this.init();
    const getStoreItems = (name) => {
      return new Promise((resolve) => {
        const tx = this.db.transaction(name, 'readonly');
        const store = tx.objectStore(name);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });
    };

    const transactions = await getStoreItems('outbox_transactions');
    const gardenSales = await getStoreItems('outbox_garden_sales');
    const contributors = await getStoreItems('outbox_contributors');

    return {
      transactions,
      gardenSales,
      contributors,
      totalPending: transactions.length + gardenSales.length + contributors.length
    };
  }

  async markOutboxSynced(processedTxIds = [], processedSaleIds = []) {
    await this.init();
    if (processedTxIds.length > 0) {
      const tx = this.db.transaction('outbox_transactions', 'readwrite');
      const store = tx.objectStore('outbox_transactions');
      for (const id of processedTxIds) {
        store.delete(id);
      }
    }
    if (processedSaleIds.length > 0) {
      const tx = this.db.transaction('outbox_garden_sales', 'readwrite');
      const store = tx.objectStore('outbox_garden_sales');
      for (const id of processedSaleIds) {
        store.delete(id);
      }
    }
  }
}

window.offlineStorage = new OfflineStorage();
