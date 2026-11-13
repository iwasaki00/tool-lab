import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { questions } from "../src/data/content";
const openLesson = async (page: Page) => {
  await page.goto("/");
  await page.getByRole("button", { name: "出荷ラインを見に行く" }).click();
  await page.getByRole("button", { name: "AIの仕分けを見てみる" }).click();
  await page
    .getByRole("button", { name: "検査済みの箱を見本に加える" })
    .click();
  await page.getByRole("button", { name: "分類を続けて試す →" }).click();
};
const scene = async (page: Page, n: number) => {
  await page.getByRole("button", { name: new RegExp(`^場面${n} `) }).click();
};
const saved = async (page: Page) => {
  await expect(page.getByText("端末に保存済み", { exact: true })).toBeVisible();
};
test("9場面、導入再訪、前後移動、途中終了・再開と全問解説", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await openLesson(page);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "見本の答え",
  );
  await page.getByRole("button", { name: "← 前へ", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "良品が、不良品レーンへ。",
  );
  await expect(page.locator(".shipping-discovery")).toContainText(
    "不良 → 良品",
  );
  await page.getByRole("button", { name: "分類を続けて試す →" }).click();
  await page.getByRole("button", { name: "← 戻る・途中終了" }).click();
  await page.reload();
  await page.getByRole("button", { name: "続きから学ぶ" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "見本の答え",
  );
  await scene(page, 3);
  await page.getByRole("button", { name: "1ステップ", exact: true }).click();
  await expect(
    page.getByText("次：平均へ中心を更新", { exact: false }),
  ).toBeVisible();
  await scene(page, 4);
  await expect(page.getByText("概念デモ：", { exact: false })).toBeVisible();
  await scene(page, 5);
  await expect(
    page.getByRole("heading", { name: "教師あり学習", exact: true }),
  ).toBeVisible();
  await scene(page, 6);
  await page.getByRole("button", { name: "教師あり学習", exact: true }).click();
  await expect(page.getByRole("status").last()).toContainText("その判断");
  await page.getByRole("checkbox").uncheck();
  await page.getByRole("button", { name: "教師なし学習", exact: true }).click();
  await expect(page.getByRole("status").last()).toContainText("その判断");
  await scene(page, 7);
  await page.getByLabel("中心にする概念").selectOption("reinforcement");
  await expect(page.locator(".map-links")).toContainText("報酬");
  await scene(page, 8);
  for (let i = 0; i < 12; i++) {
    await expect(page.getByRole("heading", { level: 3 })).toHaveText(
      questions[i].text,
    );
    await page.getByRole("radio").nth(questions[i].answer).check();
    await page.getByRole("button", { name: "回答を確定" }).click();
    await saved(page);
    await expect(page.locator(".feedback")).toContainText("正解");
    await expect(page.locator(".feedback")).toContainText(questions[i].clue);
    await page.getByText("すべての選択肢の解説", { exact: true }).click();
    for (const o of questions[i].options)
      await expect(
        page.locator("details p").filter({ hasText: o.explanation }),
      ).toBeVisible();
    if (i < 11)
      await page.getByRole("button", { name: "次の問題", exact: true }).click();
  }
  await page.getByRole("button", { name: "次へ →", exact: true }).click();
  await expect(page.locator(".summary-score")).toContainText("12 / 12");
  await page
    .getByRole("button", { name: "レッスンを最後まで学習したと記録" })
    .click();
  await saved(page);
  await expect(
    page.getByText("このレッスンを最後まで学習した記録があります。", {
      exact: false,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "12問を復習候補に登録" }).click();
  await saved(page);
  expect(errors).toEqual([]);
});
test("計算UI、連続再生の停止・リセット・設定復元", async ({ page }) => {
  await openLesson(page);
  await scene(page, 2);
  await page.getByLabel("変更する見本").selectOption("0");
  await page.getByLabel("未知の製品の大きさ").fill("18");
  await page.getByLabel("未知の製品の重さ").fill("20");
  await expect(page.locator(".result")).toContainText("良品");
  await page
    .getByRole("combobox", { name: "正解ラベル", exact: true })
    .selectOption("不良");
  await expect(page.locator(".result")).toContainText("不良");
  await scene(page, 3);
  await page.getByLabel("クラスタ数").selectOption("4");
  await page.getByLabel("初期値").selectOption("42");
  await page.getByRole("button", { name: "連続再生", exact: true }).click();
  await expect(page.getByRole("button", { name: "一時停止" })).toBeVisible();
  await page.getByRole("button", { name: "一時停止" }).click();
  await page.getByRole("button", { name: "リセット", exact: true }).click();
  await expect(page.locator(".result")).toContainText("反復 0");
  await page.getByRole("button", { name: "連続再生", exact: true }).click();
  await expect(page.locator(".result")).toContainText("収束", {
    timeout: 20000,
  });
  await scene(page, 4);
  await page.getByRole("button", { name: "再生", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "停止", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "停止", exact: true }).click();
  await page.getByRole("button", { name: "リセット", exact: true }).click();
  await expect(page.locator(".result")).toContainText("累計 0");
  await page.getByLabel("1行動の報酬").fill("5");
  await expect(page.locator(".two-col")).toContainText("合計 60");
  await page.getByLabel("再生速度").selectOption("2");
  await saved(page);
  await page.reload();
  await page.getByRole("button", { name: "続きから学ぶ" }).click();
  await expect(page.getByLabel("再生速度")).toHaveValue("2");
});
test("バックアップ置換・統合・不正拒否・履歴と復習候補の保持", async ({
  page,
}) => {
  await openLesson(page);
  await scene(page, 8);
  await page.getByRole("radio").nth(0).check();
  await page.getByRole("button", { name: "回答を確定" }).click();
  await saved(page);
  await page.getByRole("button", { name: "この問題を解き直す" }).click();
  await page.getByRole("radio").nth(1).check();
  await page.getByRole("button", { name: "回答を確定" }).click();
  await saved(page);
  await expect(page.locator(".feedback")).toContainText("もう一度");
  await page.getByRole("button", { name: "← 戻る・途中終了" }).click();
  await page.getByRole("button", { name: "記録", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSONをエクスポート" }).click();
  const dl = await download;
  const stream = await dl.createReadStream();
  let body = "";
  for await (const c of stream!) body += c.toString();
  const backup = JSON.parse(body);
  expect(backup.attempts).toHaveLength(2);
  expect(backup.reviews[0].reason).toBe("incorrect");
  const upload = page.getByLabel("JSONから復元");
  await upload.setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(body),
  });
  await page.getByRole("button", { name: "この内容を復元" }).click();
  await saved(page);
  await expect(page.locator(".stats-row").first()).toContainText("2件");
  await upload.setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"formatVersion":99}'),
  });
  await expect(
    page.getByText(
      "バックアップの形式または整合性が不正です。保存内容は変更していません。",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "この内容を復元" }),
  ).toHaveCount(0);
  await upload.setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(body),
  });
  await page.getByLabel("復元方法").selectOption("replace");
  page.once("dialog", (d) => d.dismiss());
  await page.getByRole("button", { name: "この内容を復元" }).click();
  await expect(
    page.getByRole("button", { name: "この内容を復元" }),
  ).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "この内容を復元" }).click();
  await saved(page);
  await page.reload();
  await page.getByRole("button", { name: "続きから学ぶ" }).click();
  await expect(page.locator(".feedback")).toContainText("もう一度");
});
test("保存失敗を保存済みと表示せず再試行する", async ({ page }) => {
  await page.addInitScript(() => {
    const original = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (
      this: IDBDatabase,
      ...args: Parameters<IDBDatabase["transaction"]>
    ) {
      if (
        args[1] === "readwrite" &&
        !(window as unknown as { allowSave: boolean }).allowSave
      )
        throw new DOMException("test write failure", "QuotaExceededError");
      return original.apply(this, args);
    } as IDBDatabase["transaction"];
  });
  await openLesson(page);
  await scene(page, 2);
  await expect(
    page.getByText(
      "保存に失敗しました。再試行またはバックアップを保存してください。",
    ),
  ).toBeVisible();
  await expect(page.getByText("端末に保存済み", { exact: true })).toHaveCount(
    0,
  );
  await page.evaluate(() => {
    (window as unknown as { allowSave: boolean }).allowSave = true;
  });
  await page.getByRole("button", { name: "保存を再試行" }).click();
  await saved(page);
});
test("PWA全資産のキャッシュとオフライン再読込・9場面・履歴復元", async ({
  page,
  context,
}) => {
  await openLesson(page);
  await scene(page, 8);
  await page.getByRole("radio").nth(0).check();
  await page.getByRole("button", { name: "回答を確定" }).click();
  await saved(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  const assets = await page.evaluate(async () => {
    const names = await caches.keys();
    const c = await caches.open(names.find((n) => n.startsWith("why-g-"))!);
    return (await c.keys()).map((r) => new URL(r.url).pathname);
  });
  expect(assets.some((a) => a.endsWith(".js"))).toBe(true);
  expect(assets.some((a) => a.endsWith(".css"))).toBe(true);
  expect(assets.some((a) => a.endsWith("/index.html"))).toBe(true);
  expect(assets.some((a) => a.endsWith("/icon-192.png"))).toBe(true);
  page.on("pageerror", (e) => console.log("offline page error", e.message));
  page.on("requestfailed", (r) =>
    console.log("offline request failed", r.url(), r.failure()?.errorText),
  );
  await context.setOffline(true);
  await page.reload();
  await page.getByRole("button", { name: "続きから学ぶ" }).click();
  await expect(page.locator(".feedback")).toContainText("正解");
  for (let n = 1; n <= 9; n++) {
    await scene(page, n);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    if (n === 1)
      await page.getByRole("button", { name: "分類を続けて試す →" }).click();
  }
  await expect(page.getByText("オフライン", { exact: true })).toBeVisible();
  await context.setOffline(false);
});
test("320px幅の5画面と9場面に横溢れがない", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "出荷ラインを見に行く" }),
  ).toBeVisible();
  if (test.info().project.name === "chromium")
    await page.screenshot({
      path: "test-results/home-desktop.png",
      fullPage: true,
    });
  await page.setViewportSize({ width: 320, height: 740 });
  const noOverflow = async () =>
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  for (const name of ["ホーム", "コース", "演習", "知識マップ", "記録"]) {
    await page.getByRole("button", { name, exact: true }).click();
    await noOverflow();
  }
  await page.getByRole("button", { name: "ホーム", exact: true }).click();
  await page.screenshot({
    path: `test-results/home-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "出荷ラインを見に行く" }).click();
  await page.getByRole("button", { name: "AIの仕分けを見てみる" }).click();
  await page
    .getByRole("button", { name: "検査済みの箱を見本に加える" })
    .click();
  await page.getByRole("button", { name: "分類を続けて試す →" }).click();
  for (let n = 1; n <= 9; n++) {
    await scene(page, n);
    await noOverflow();
    if (n === 1)
      await page.getByRole("button", { name: "分類を続けて試す →" }).click();
  }
  await scene(page, 2);
  await page.screenshot({
    path: `test-results/lesson-${test.info().project.name}.png`,
    fullPage: true,
  });
});
