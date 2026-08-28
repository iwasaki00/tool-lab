(() => {
  "use strict";

  const DB_NAME = "oumu-gaeshi-audio";
  const DB_VERSION = 1;
  const STORE_NAME = "favorites";
  let databasePromise = null;

  function open() {
    if (!window.indexedDB) return Promise.reject(new Error("IndexedDB is not supported"));
    if (databasePromise) return databasePromise;
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME, { keyPath: "id" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("IndexedDB open failed"));
    });
    return databasePromise;
  }

  async function transaction(mode, action) {
    const database = await open();
    return new Promise((resolve, reject) => {
      const tx = database.transaction(STORE_NAME, mode);
      const store = tx.objectStore(STORE_NAME);
      let request;
      try { request = action(store); } catch (error) { reject(error); return; }
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("IndexedDB request failed"));
    });
  }

  const list = () => transaction("readonly", (store) => store.getAll());
  const put = (item) => transaction("readwrite", (store) => store.put(item));
  const remove = (id) => transaction("readwrite", (store) => store.delete(id));
  async function rename(id, name) {
    const item = await transaction("readonly", (store) => store.get(id));
    if (!item) throw new Error("Favorite not found");
    item.name = name;
    item.updatedAt = Date.now();
    await put(item);
    return item;
  }

  window.OumuFavoriteStore = { open, list, put, remove, rename };
})();
