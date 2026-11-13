import type { Backup } from "../types";
import { emptyBackup, validateBackup } from "./learning";
const DB = "why-learn-g";
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore("state");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.onblocked = () => reject(Error("別タブを閉じて再試行してください"));
  });
}
export async function loadState(): Promise<Backup> {
  const db = await openDB();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("state", "readonly"),
        r = tx.objectStore("state").get("snapshot");
      tx.oncomplete = () => {
        try {
          resolve(r.result ? validateBackup(r.result) : emptyBackup());
        } catch (e) {
          reject(e);
        }
      };
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
export async function saveState(state: Backup): Promise<void> {
  const safe = validateBackup(state);
  const db = await openDB();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("state", "readwrite");
      tx.objectStore("state").put(safe, "snapshot");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? Error("保存を中止しました"));
    });
  } finally {
    db.close();
  }
}
