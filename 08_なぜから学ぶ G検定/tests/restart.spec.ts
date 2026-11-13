import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { readFileSync } from "node:fs";
const legacy = JSON.parse(
  readFileSync(
    new URL("./fixtures/v0.1.1-backup.json", import.meta.url),
    "utf8",
  ),
);
const saved = async (page: Page) =>
  expect(page.getByText("端末に保存済み", { exact: true })).toBeVisible();
async function data(page: Page) {
  return page.evaluate(
    () =>
      new Promise<any>((resolve, reject) => {
        const r = indexedDB.open("why-learn-g", 1);
        r.onsuccess = () => {
          const db = r.result,
            tx = db.transaction("state", "readonly"),
            q = tx.objectStore("state").get("snapshot");
          tx.oncomplete = () => {
            resolve(q.result);
            db.close();
          };
          tx.onerror = () => reject(tx.error);
        };
        r.onerror = () => reject(r.error);
      }),
  );
}
async function install(page: Page, value: unknown) {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "出荷ラインを見に行く" }),
  ).toBeVisible();
  await page.evaluate(
    (value) =>
      new Promise<void>((resolve, reject) => {
        const r = indexedDB.open("why-learn-g", 1);
        r.onsuccess = () => {
          const db = r.result,
            tx = db.transaction("state", "readwrite");
          tx.objectStore("state").put(value, "snapshot");
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
        r.onerror = () => reject(r.error);
      }),
    value,
  );
  await page.reload();
}
const exit = async (page: Page) =>
  page.getByRole("button", { name: "← 戻る・途中終了" }).click();

test("390×844：プロローグから人とAIの食い違い、見本追加へ進み3画面を撮影", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "出荷ラインを見に行く" }).click();
  await saved(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "出荷まで、あと1時間。",
  );
  await expect(page.locator("input,select")).toHaveCount(0);
  await expect(page.locator(".scene-body button")).toHaveCount(1);
  const picture = page.getByRole("img", { name: /仕分け待ちの箱/ }),
    action = page.getByRole("button", { name: "AIの仕分けを見てみる" }),
    narration = page.locator(".prologue-narration");
  await expect(narration).toHaveText(
    "出荷前の工場。検査員が一箱ずつ確認しているが、仕分けが追いつかない。",
  );
  await expect(page.locator(".inspector-line")).toContainText(
    "判定が合っているかは、私が確かめるよ",
  );
  for (const el of [picture, narration, action]) {
    const b = await el.boundingBox();
    expect(b!.y).toBeGreaterThanOrEqual(0);
    expect(b!.y + b!.height).toBeLessThanOrEqual(844);
  }
  expect(await page.evaluate(() => scrollY)).toBe(0);
  await page.screenshot({
    path: `docs/screenshots/v0.1.2/prologue-${test.info().project.name}.png`,
    fullPage: true,
  });
  await action.click();
  await saved(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "良品が、不良品レーンへ。",
  );
  await expect(page.locator(".shipping-verdicts")).toContainText(
    "検査員の確認：合格",
  );
  await expect(page.locator(".shipping-verdicts")).toContainText(
    "AIの判定：不良",
  );
  await expect(page.locator(".shipping-discovery")).toHaveCount(0);
  await page.screenshot({
    path: `docs/screenshots/v0.1.2/intro-before-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "検査済みの箱を見本に加える" })
    .click();
  await saved(page);
  await expect(page.locator(".shipping-verdicts")).toContainText(
    "AIの判定：良品",
  );
  await expect(page.locator(".shipping-discovery")).toContainText(
    "不良 → 良品",
  );
  await page.screenshot({
    path: `docs/screenshots/v0.1.2/intro-after-${test.info().project.name}.png`,
    fullPage: true,
  });
  expect((await data(page)).attempts).toHaveLength(0);
});

test("完了済みデータから最初から学ぶ：現在のプレイだけ初期化し、完了履歴を残して再完了・再開始", async ({
  page,
}) => {
  const done = {
    ...legacy,
    progress: {
      ...legacy.progress,
      scene: 8,
      completed: true,
      visited: [0, 1, 2, 3, 4, 5, 6, 8],
      questionIndex: 5,
      challenge: 2,
      challengeLabelled: false,
    },
  };
  await install(page, done);
  await expect(
    page.getByRole("button", { name: "続きから学ぶ" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "最初から学ぶ" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "続きから学ぶ" }).click();
  await expect(
    page.getByText("このレッスンを最後まで学習した記録があります。", {
      exact: false,
    }),
  ).toBeVisible();
  await exit(page);
  await page.getByRole("button", { name: "最初から学ぶ" }).click();
  await saved(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "出荷まで、あと1時間。",
  );
  let b = await data(page);
  expect(b.progress).toMatchObject({
    scene: 0,
    visited: [0],
    questionIndex: 0,
    completed: false,
    storySampleAdded: false,
    introStage: "prologue",
    predictions: [-1, -1, -1],
    challenge: null,
    challengeLabelled: true,
  });
  expect(b.progress.sessionId).not.toBe(done.progress.sessionId);
  expect(b.attempts).toEqual(done.attempts);
  expect(b.reviews).toEqual(done.reviews);
  expect(b.settings).toEqual(done.settings);
  expect(b.completions).toHaveLength(1);
  expect(b.completions[0].recordedAt).toBe(done.progress.updatedAt);
  await page.getByRole("button", { name: "AIの仕分けを見てみる" }).click();
  await expect(page.locator(".shipping-verdicts")).toContainText(
    "AIの判定：不良",
  );
  await page
    .getByRole("button", { name: "検査済みの箱を見本に加える" })
    .click();
  await saved(page);
  await exit(page);
  await page.getByRole("button", { name: "続きから学ぶ" }).click();
  await expect(page.locator(".shipping-verdicts")).toContainText(
    "AIの判定：良品",
  );
  await page.getByRole("button", { name: "分類を続けて試す →" }).click();
  for (let n = 2; n < 7; n++)
    await page.getByRole("button", { name: "次へ →", exact: true }).click();
  await page.getByRole("button", { name: "まとめへ →" }).click();
  await page
    .getByRole("button", { name: "レッスンを最後まで学習したと記録" })
    .click();
  await saved(page);
  await exit(page);
  await page.getByRole("button", { name: "最初から学ぶ" }).click();
  await saved(page);
  b = await data(page);
  expect(b.completions).toHaveLength(2);
  expect(b.attempts).toEqual(done.attempts);
  expect(b.reviews).toEqual(done.reviews);
  await exit(page);
  await page.getByRole("button", { name: "記録", exact: true }).click();
  await expect(page.locator(".completion-history li")).toHaveCount(2);
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSONをエクスポート" }).click();
  const dl = await downloading,
    stream = await dl.createReadStream();
  let body = "";
  for await (const c of stream!) body += c.toString();
  expect(JSON.parse(body).completions).toHaveLength(2);
  await page.getByLabel("JSONから復元").setInputFiles({
    name: "records.json",
    mimeType: "application/json",
    buffer: Buffer.from(body),
  });
  await page.getByRole("button", { name: "この内容を復元" }).click();
  await saved(page);
  expect((await data(page)).completions).toHaveLength(2);
  await page.getByLabel("JSONから復元").setInputFiles({
    name: "records.json",
    mimeType: "application/json",
    buffer: Buffer.from(body),
  });
  await page.getByLabel("復元方法").selectOption("replace");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "この内容を復元" }).click();
  await saved(page);
  await page.reload();
  await page.getByRole("button", { name: "続きから学ぶ" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "出荷まで、あと1時間。",
  );
  expect((await data(page)).completions).toHaveLength(2);
});

test("更新前の操作済み保存は誤判定体験の操作後へ直接再開し、やり直し後のプロローグもオフラインで利用可能", async ({
  page,
  context,
}) => {
  await install(page, legacy);
  await page.getByRole("button", { name: "続きから学ぶ" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "良品が、不良品レーンへ。",
  );
  await expect(page.locator(".shipping-verdicts")).toContainText(
    "AIの判定：良品",
  );
  await expect(
    page.getByRole("button", { name: "AIの仕分けを見てみる" }),
  ).toHaveCount(0);
  await exit(page);
  await page.getByRole("button", { name: "最初から学ぶ" }).click();
  await saved(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await context.setOffline(true);
  await page.reload();
  await page.getByRole("button", { name: "続きから学ぶ" }).click();
  await expect(page.getByRole("img", { name: /仕分け待ちの箱/ })).toBeVisible();
  await page.getByRole("button", { name: "AIの仕分けを見てみる" }).click();
  await expect(page.locator(".shipping-verdicts")).toContainText(
    "AIの判定：不良",
  );
  await page
    .getByRole("button", { name: "検査済みの箱を見本に加える" })
    .click();
  await saved(page);
  await page.reload();
  await page.getByRole("button", { name: "続きから学ぶ" }).click();
  await expect(page.locator(".shipping-verdicts")).toContainText(
    "AIの判定：良品",
  );
  expect((await data(page)).attempts).toEqual(legacy.attempts);
  await context.setOffline(false);
});

test("プロローグも320px・文字200%相当で切れや横溢れなく操作できる", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/");
  await page.getByRole("button", { name: "出荷ラインを見に行く" }).click();
  await page.addStyleTag({
    content:
      ".story-intro{font-size:28px}.story-intro h1,.story-intro p,.story-intro button,.inspector-line>span{font-size:inherit!important}",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const image = await page.locator(".shipping-illustration").boundingBox(),
    narration = await page.locator(".prologue-narration").boundingBox(),
    line = await page.locator(".inspector-line").boundingBox(),
    button = await page.locator(".story-action").boundingBox();
  expect(image!.y + image!.height).toBeLessThanOrEqual(narration!.y);
  expect(narration!.y + narration!.height).toBeLessThanOrEqual(line!.y);
  expect(line!.y + line!.height).toBeLessThanOrEqual(button!.y);
  await page.screenshot({
    path: `docs/screenshots/v0.1.2/prologue-large-text-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "AIの仕分けを見てみる" }).click();
  await expect(page.locator(".shipping-verdicts")).toContainText(
    "AIの判定：不良",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
