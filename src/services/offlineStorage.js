/**
 * Offline Storage Service using IndexedDB
 * Stores full article content and images for offline access.
 */

const DB_NAME = 'BanglaNews_Offline';
const STORE_NAME = 'articles';
const DB_VERSION = 1;

let db = null;

const initDB = () => {
    return new Promise((resolve, reject) => {
        if (db) return resolve(db);

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };

        request.onsuccess = (e) => {
            db = e.target.result;
            resolve(db);
        };

        request.onerror = (e) => reject(e.target.error);
    });
};

export const saveForOffline = async (article) => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        // Ensure we have a timestamp for when it was saved
        const articleToSave = {
            ...article,
            savedAt: Date.now()
        };

        const request = store.put(articleToSave);
        request.onsuccess = () => resolve(true);
        request.onerror = (e) => reject(e.target.error);
    });
};

export const getOfflineArticles = async () => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
            const results = request.result || [];
            // Sort by savedAt descending
            resolve(results.sort((a, b) => b.savedAt - a.savedAt));
        };
        request.onerror = (e) => reject(e.target.error);
    });
};

export const removeOfflineArticle = async (id) => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);

        request.onsuccess = () => resolve(true);
        request.onerror = (e) => reject(e.target.error);
    });
};

export const isArticleSaved = async (id) => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);

        request.onsuccess = () => resolve(!!request.result);
        request.onerror = (e) => reject(e.target.error);
    });
};
