import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { emptyBackup } from "../src/engine/learning";
export const saved = async (page: Page) =>
  expect(page.getByText("端末に保存済み", { exact: true })).toBeVisible();
export async function readSnapshot(page: Page) {
  return page.evaluate(
    () =>
      new Promise<any>((resolve, reject) => {
        const r = indexedDB.open("why-learn-g", 1);
        r.onsuccess = () => {
          const db = r.result,
            tx = db.transaction("state", "readonly"),
            q = tx.objectStore("state").get("snapshot");
          tx.oncomplete = () => {
            db.close();
            resolve(q.result);
          };
          tx.onerror = () => reject(tx.error);
        };
        r.onerror = () => reject(r.error);
      }),
  );
}
export async function seedLegacy(page: Page) {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "3分で全体像を見る" }),
  ).toBeVisible();
  const value = emptyBackup();
  value.progress.started = true;
  await page.evaluate(
    (value) =>
      new Promise<void>((resolve, reject) => {
        const w = window as unknown as { allowSave?: boolean },
          before = w.allowSave;
        w.allowSave = true;
        const r = indexedDB.open("why-learn-g", 1);
        r.onsuccess = () => {
          const db = r.result,
            tx = db.transaction("state", "readwrite");
          tx.objectStore("state").put(value, "snapshot");
          tx.oncomplete = () => {
            w.allowSave = before;
            db.close();
            resolve();
          };
          tx.onerror = () => {
            w.allowSave = before;
            reject(tx.error);
          };
        };
        r.onerror = () => {
          w.allowSave = before;
          reject(r.error);
        };
      }),
    value,
  );
  await page.reload();
}
export async function firstBox(page: Page) {
  await page.getByRole("button", { name: "3分で全体像を見る" }).click();
  await page.getByRole("button", { name: "第1話で、AIの学び方を試す" }).click();
  await page.getByRole("button", { name: "仕分け台へ行く" }).click();
  await page.getByRole("button", { name: "最初の箱を流す" }).click();
}
// Starts after adding W; never opens settings, reference materials or exam.
export async function finishEpisode(page: Page) {
  await page.getByRole("button", { name: "搬送の様子を見る" }).click();
  await page.getByRole("button", { name: "似た搬送記録をまとめる" }).click();
  await page.getByRole("button", { name: "別の搬送経路を試す" }).click();
  await page.getByRole("button", { name: "2つの運び方を比べる" }).click();
  await page
    .getByRole("button", { name: "箱を丁寧に運ぶ", exact: true })
    .click();
  await page.getByRole("button", { name: "出荷を見届ける" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "トラックが来た。",
  );
}
