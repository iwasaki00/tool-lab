import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { finishEpisode } from "./helpers";
const legacy = JSON.parse(
  readFileSync(
    new URL("./fixtures/v0.1.0-backup.json", import.meta.url),
    "utf8",
  ),
);
import type { Page } from "@playwright/test";
const saved = async (page: Page) =>
  expect(page.getByText("端末に保存済み", { exact: true })).toBeVisible();
const open = async (page: Page) => {
  await page.goto("/");
  await page.getByRole("button", { name: "出荷ラインを見に行く" }).click();
  await saved(page);
  await page.getByRole("button", { name: "仕分け台へ行く" }).click();
  await page.getByRole("button", { name: "最初の箱を流す" }).click();
  await saved(page);
};
async function snapshot(page: Page) {
  return await page.evaluate(async () => {
    return await new Promise<any>((resolve, reject) => {
      const r = indexedDB.open("why-learn-g", 1);
      r.onsuccess = () => {
        const db = r.result,
          tx = db.transaction("state", "readonly"),
          get = tx.objectStore("state").get("snapshot");
        tx.oncomplete = () => {
          resolve(get.result);
          db.close();
        };
        tx.onerror = () => reject(tx.error);
      };
      r.onerror = () => reject(r.error);
    });
  });
}

test("390×844：回答や選択なしで最初の発見、挿絵とボタンが初期画面内に収まる", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "良品が、不良品レーンへ。",
  );
  await expect(page.locator("select,input")).toHaveCount(0);
  await expect(page.getByText("教師あり学習", { exact: false })).toHaveCount(0);
  await expect(page.locator(".scene-body button")).toHaveCount(1);
  const image = page.getByRole("img", { name: /現在の判定は不良/ }),
    action = page.getByRole("button", { name: "検査済みの箱を見本に加える" });
  const beforeBox = await image.boundingBox(),
    buttonBox = await action.boundingBox();
  expect(beforeBox!.y).toBeGreaterThanOrEqual(0);
  expect(beforeBox!.y + beforeBox!.height).toBeLessThanOrEqual(844);
  expect(buttonBox!.y + buttonBox!.height).toBeLessThanOrEqual(844);
  expect(await page.evaluate(() => scrollY)).toBe(0);
  await page.screenshot({
    path: `docs/screenshots/v0.1.5/intro-before-${test.info().project.name}.png`,
    fullPage: true,
  });
  const positionBefore = await page
    .locator('[data-box="Q"]')
    .getAttribute("transform");
  await action.click();
  await saved(page);
  expect(
    await page.locator('[data-box="Q"]').getAttribute("transform"),
  ).not.toBe(positionBefore);
  await expect(
    page.getByRole("img", { name: /現在の判定は良品/ }),
  ).toBeVisible();
  await expect(page.locator(".shipping-discovery")).toContainText(
    "不良 → 良品",
  );
  await expect(page.locator(".shipping-discovery")).toContainText(
    "人が付けた答えを見本にして、新しい箱を判定する。これが教師あり学習の例です",
  );
  await expect(
    page.getByRole("button", { name: "搬送の様子を見る" }),
  ).toBeVisible();
  const aiLabel = await page.locator(".shipping-ai-verdict rect").boundingBox();
  const humanLabel = await page.locator(".shipping-human-check").boundingBox();
  expect(humanLabel!.y).toBeGreaterThanOrEqual(aiLabel!.y + aiLabel!.height);
  expect((await snapshot(page)).attempts).toHaveLength(0);
  await page.screenshot({
    path: `docs/screenshots/v0.1.5/intro-after-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.getByText("仕組みを詳しく見る", { exact: true }).click();
  await expect(page.locator(".result")).toContainText("予測：良品");
  await expect(page.getByLabel("変更する見本")).toContainText("BOX-W");
});

test("試験を選ばずにまとめと完了へ進め、演習メニューから直接出題できる", async ({
  page,
}) => {
  await open(page);
  await page
    .getByRole("button", { name: "検査済みの箱を見本に加える" })
    .click();
  await finishEpisode(page);
  await page.getByRole("button", { name: "ここで終える" }).click();
  await saved(page);
  const data = await snapshot(page);
  expect(data.attempts).toEqual([]);
  expect(data.progress.completed).toBe(true);
  expect(data.progress.visited).not.toContain(7);
  await page.reload();
  await page.getByRole("button", { name: "続きから学ぶ" }).click();
  await expect(
    page.getByText("このレッスンを最後まで学習した記録があります。", {
      exact: false,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "← 戻る・途中終了" }).click();
  await page.getByRole("button", { name: "演習", exact: true }).click();
  await page.getByRole("button", { name: "新しい演習を始める" }).click();
  await expect(page.getByRole("radio")).toHaveCount(4);
  await expect(page.getByText("L003-Q01 · v1")).toBeVisible();
});

test("v0.1.0の途中データをその場から再開し、導入再訪と旧JSON復元でも履歴を保持", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "出荷ラインを見に行く" }),
  ).toBeVisible();
  await page.evaluate(async (legacy) => {
    await new Promise<void>((resolve, reject) => {
      const r = indexedDB.open("why-learn-g", 1);
      r.onsuccess = () => {
        const db = r.result,
          tx = db.transaction("state", "readwrite");
        tx.objectStore("state").put(legacy, "snapshot");
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      r.onerror = () => reject(r.error);
    });
  }, legacy);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "続きから学ぶ" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "最初から学ぶ" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "続きから学ぶ" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "答えがなくても",
  );
  await expect(page.getByLabel("再生速度")).toHaveValue("2");
  await saved(page);
  let data = await snapshot(page);
  expect(data.progress.scene).toBe(2);
  expect(data.progress.predictions).toEqual(legacy.progress.predictions);
  expect(data.attempts).toEqual(legacy.attempts);
  expect(data.reviews).toEqual(legacy.reviews);
  await page.getByRole("button", { name: "← 戻る・途中終了" }).click();
  await page.getByRole("button", { name: "最初から学ぶ" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "今日は、いつもどおりのはずだった",
  );
  await page.getByRole("button", { name: "仕分け台へ行く" }).click();
  await page.getByRole("button", { name: "最初の箱を流す" }).click();
  await expect(
    page.getByRole("button", { name: "検査済みの箱を見本に加える" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "検査済みの箱を見本に加える" })
    .click();
  await saved(page);
  expect((await snapshot(page)).attempts).toEqual(legacy.attempts);
  await page.getByRole("button", { name: "← 戻る・途中終了" }).click();
  await page.getByRole("button", { name: "記録", exact: true }).click();
  await page.getByLabel("JSONから復元").setInputFiles({
    name: "v0.1.0.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(legacy)),
  });
  await page.getByLabel("復元方法").selectOption("replace");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "この内容を復元" }).click();
  await saved(page);
  await page.reload();
  await page.getByRole("button", { name: "続きから学ぶ" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "答えがなくても",
  );
  data = await snapshot(page);
  expect(data.attempts).toEqual(legacy.attempts);
  expect(data.reviews).toEqual(legacy.reviews);
});

test("オフラインでも挿絵・見本追加・説明が表示され、操作後の位置を再開する", async ({
  page,
  context,
}) => {
  await open(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await context.setOffline(true);
  await page.reload();
  await page.getByRole("button", { name: "続きから学ぶ" }).click();
  await expect(
    page.getByRole("img", { name: /現在の判定は不良/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "検査済みの箱を見本に加える" })
    .click();
  await saved(page);
  await page.reload();
  await page.getByRole("button", { name: "続きから学ぶ" }).click();
  await expect(
    page.getByRole("img", { name: /現在の判定は良品/ }),
  ).toBeVisible();
  await expect(page.locator(".shipping-discovery")).toContainText(
    "不良 → 良品",
  );
  await expect(page.getByText("オフライン", { exact: true })).toBeVisible();
  await context.setOffline(false);
});

test("320pxと文字200%相当で横溢れ・挿絵やボタンの重なりがない", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await open(page);
  await page.addStyleTag({
    content:
      ".story-intro{font-size:28px}.story-intro h1,.story-intro p,.story-intro button,.inspector-line>span{font-size:inherit!important}",
  });
  const check = async () => {
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    const image = await page.locator(".shipping-illustration").boundingBox(),
      line = await page.locator(".inspector-line").boundingBox(),
      button = await page.locator(".story-action").boundingBox();
    expect(image!.y + image!.height).toBeLessThanOrEqual(line!.y);
    expect(line!.y + line!.height).toBeLessThanOrEqual(button!.y);
    const card = await page.locator(".scene-body").boundingBox();
    expect(button!.x).toBeGreaterThanOrEqual(card!.x);
    expect(button!.x + button!.width).toBeLessThanOrEqual(
      card!.x + card!.width,
    );
  };
  await check();
  await page
    .getByRole("button", { name: "検査済みの箱を見本に加える" })
    .click();
  await check();
  await page.screenshot({
    path: `docs/screenshots/v0.1.5/intro-large-text-${test.info().project.name}.png`,
    fullPage: true,
  });
});
