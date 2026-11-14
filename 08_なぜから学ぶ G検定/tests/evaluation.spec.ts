import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { saved, readSnapshot, finishEpisode } from "./helpers";
import {
  sortingA,
  sortingB,
  evaluationQuestions,
} from "../src/data/evaluation";
import { summarizeInspection, percent } from "../src/engine/evaluation";
const old = JSON.parse(
  readFileSync(
    new URL("./fixtures/v0.1.1-backup.json", import.meta.url),
    "utf8",
  ),
);
const card = (page: Page) =>
  page.locator('.evaluation-course[data-lesson="L004"]');
async function open(page: Page) {
  await page.getByRole("button", { name: "コース", exact: true }).click();
  await card(page)
    .getByRole("button", { name: /第2話を始める|続きから学ぶ/ })
    .click();
  await saved(page);
}
const shot = async (page: Page, name: string) =>
  page.screenshot({
    path: `docs/screenshots/v0.1.6/${name}-${test.info().project.name}.png`,
    fullPage: true,
  });
async function runToEnd(page: Page) {
  for (const name of [
    "100箱を流す",
    "別の仕分け設定で試す",
    "見るべき数字を振り返る",
  ])
    await page.getByRole("button", { name, exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "数字を見る前に、何を避けたいか。",
  );
}
async function install(page: Page) {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "3分で全体像を見る" }),
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
      }),
    old,
  );
  await page.reload();
}

test("390px：未読でも始め、100箱の見逃しを発見しA/Bを比較、演習なしで完了", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await open(page);
  const initial = await readSnapshot(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "翌朝、出荷ラインで試運転。",
  );
  await expect(page.locator(".evaluation-note")).toContainText(
    "学習用の見本には加えず",
  );
  await expect(
    page.locator(".scene-body input,.scene-body select"),
  ).toHaveCount(0);
  await expect(page.locator(".scene-body button")).toHaveCount(1);
  await shot(page, "evaluation-intro");
  await page.getByRole("button", { name: "100箱を流す" }).click();
  const a = summarizeInspection(sortingA),
    b = summarizeInspection(sortingB);
  await expect(page.locator(".evaluation-headline")).toContainText(
    `${a.total}箱中${a.matched}箱`,
  );
  await expect(page.locator(".evaluation-headline")).toContainText(
    percent(a.accuracy),
  );
  await expect(page.locator(".evaluation-verdicts")).toContainText(
    "人の検査結果：不良",
  );
  await expect(page.locator(".evaluation-verdicts")).toContainText(
    "AIの判定：良品として通した",
  );
  await expect(page.locator("svg [data-evaluation-box]")).toHaveCount(100);
  await expect(
    page.getByRole("heading", { name: "試験での呼び方" }),
  ).toHaveCount(0);
  await shot(page, "evaluation-discovery");
  await page.getByRole("button", { name: "別の仕分け設定で試す" }).click();
  const rows = page.locator(".evaluation-comparison tbody tr");
  for (const [i, values] of [
    [0, [a.matched, b.matched]],
    [1, [a.falseNegative, b.falseNegative]],
    [2, [a.falsePositive, b.falsePositive]],
  ] as const) {
    for (let j = 0; j < 2; j++)
      await expect(rows.nth(i).locator("td").nth(j)).toContainText(
        values[j] + "箱",
      );
  }
  await expect(rows.nth(0)).toContainText("99％");
  await expect(rows.nth(0)).toContainText("98％");
  await expect(
    page.locator(".evaluation-batch").nth(0).locator(".missed"),
  ).toHaveCount(1);
  await expect(
    page.locator(".evaluation-batch").nth(1).locator(".missed"),
  ).toHaveCount(0);
  await expect(
    page.locator(".evaluation-batch").nth(1).locator(".overstopped"),
  ).toHaveCount(2);
  await expect(
    page.locator(".evaluation-batch .evaluation-box-grid span"),
  ).toHaveCount(200);
  await shot(page, "evaluation-comparison");
  await page.getByRole("button", { name: "見るべき数字を振り返る" }).click();
  await expect(page.locator(".evaluation-terms")).toContainText("A：0/1＝0％");
  await expect(page.locator(".evaluation-terms")).toContainText(
    "B：1/1＝100％",
  );
  await expect(page.locator(".scene-body")).toContainText("止まった良品2箱");
  await expect(page.locator(".scene-body")).toContainText(
    "本番の安全が保証されるわけでもありません",
  );
  await expect(page.locator("details[open]")).toHaveCount(0);
  await shot(page, "evaluation-ending");
  await page.getByText("詳しく見る：混同行列", { exact: true }).click();
  const matrices = page.locator(".evaluation-matrix");
  await expect(matrices.nth(0).locator("tbody td")).toHaveText([
    "99箱",
    "0箱",
    "1箱",
    "0箱",
  ]);
  await expect(matrices.nth(1).locator("tbody td")).toHaveText([
    "97箱",
    "2箱",
    "0箱",
    "1箱",
  ]);
  await shot(page, "evaluation-confusion");
  await page.getByRole("button", { name: "ここで終える" }).click();
  await saved(page);
  const done = await readSnapshot(page);
  expect(done.progress).toEqual(initial.progress);
  expect(done.attempts).toEqual(initial.attempts);
  expect(done.evaluation.completed).toBe(true);
  expect(done.evaluationAttempts ?? []).toEqual([]);
  expect(
    done.completions.filter((c: any) => c.lessonId === "L004"),
  ).toHaveLength(1);
  await page.getByRole("button", { name: "ホーム", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "続きから学ぶ" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "第0章を見る", exact: true }).click();
  await page.getByRole("button", { name: "第1話で、AIの学び方を試す" }).click();
  await saved(page);
  expect((await readSnapshot(page)).progress.episode.stage).toBe("sorting");
  expect((await readSnapshot(page)).evaluation).toEqual(done.evaluation);
});

test("両話の独立した再開・やり直し、旧履歴、3問の解説とバックアップ往復", async ({
  page,
}) => {
  await install(page);
  await open(page);
  await page.getByRole("button", { name: "100箱を流す" }).click();
  await saved(page);
  const original = await readSnapshot(page);
  expect(original.progress).toEqual(old.progress);
  await page.getByRole("button", { name: "← 戻る・途中終了" }).click();
  await page.reload();
  await open(page);
  await expect(page.locator(".evaluation-verdicts")).toContainText("見逃し");
  await page.getByRole("button", { name: "別の仕分け設定で試す" }).click();
  await saved(page);
  await page.reload();
  await open(page);
  await expect(page.locator(".evaluation-comparison")).toBeVisible();
  await page.getByRole("button", { name: "見るべき数字を振り返る" }).click();
  await page.getByRole("button", { name: "試験問題で確認する" }).click();
  for (let i = 0; i < 3; i++) {
    const q = evaluationQuestions[i];
    await expect(page.getByRole("heading", { level: 3 })).toHaveText(q.text);
    await page.getByRole("radio").nth(q.answer).check();
    await page.getByRole("button", { name: "回答を確定" }).click();
    await saved(page);
    await expect(page.locator(".feedback")).toContainText(q.clue);
    await page.getByText("すべての選択肢の解説", { exact: true }).click();
    for (const o of q.options)
      await expect(
        page.locator("details p").filter({ hasText: o.explanation }),
      ).toBeVisible();
    if (i < 2)
      await page.getByRole("button", { name: "次の問題", exact: true }).click();
  }
  await expect(
    page.getByRole("button", { name: "次の問題", exact: true }),
  ).toBeDisabled();
  await page.reload();
  await open(page);
  await expect(page.locator(".feedback")).toContainText(
    evaluationQuestions[2].clue,
  );
  await page.getByRole("button", { name: "物語の結末に戻る" }).click();
  await page.getByRole("button", { name: "ここで終える" }).click();
  await saved(page);
  let state = await readSnapshot(page);
  expect(state.progress).toEqual(old.progress);
  expect(state.attempts).toEqual(old.attempts);
  expect(state.reviews).toEqual(old.reviews);
  expect(state.evaluationAttempts).toHaveLength(3);
  await page.getByRole("button", { name: "記録", exact: true }).click();
  await expect(
    page.locator(".stats-row article").first().locator("strong"),
  ).toHaveText(new RegExp("^\\s*" + (old.attempts.length + 3) + "\\s*件\\s*$"));
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSONをエクスポート" }).click();
  const dl = await downloading,
    stream = await dl.createReadStream();
  let body = "";
  for await (const chunk of stream!) body += chunk.toString();
  expect(JSON.parse(body).evaluationAttempts).toHaveLength(3);
  await page.getByRole("button", { name: "コース", exact: true }).click();
  await card(page).getByRole("button", { name: "最初から学ぶ" }).click();
  await saved(page);
  expect((await readSnapshot(page)).evaluation.stage).toBe("intro");
  await page.getByRole("button", { name: "← 戻る・途中終了" }).click();
  await page.getByRole("button", { name: "記録", exact: true }).click();
  await page.getByLabel("JSONから復元").setInputFiles({
    name: "both-lessons.json",
    mimeType: "application/json",
    buffer: Buffer.from(body),
  });
  await page.getByLabel("復元方法").selectOption("replace");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "この内容を復元" }).click();
  await saved(page);
  await page.reload();
  await open(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "数字を見る前に、何を避けたいか。",
  );
  await page.getByRole("button", { name: "← 戻る・途中終了" }).click();
  await card(page).getByRole("button", { name: "最初から学ぶ" }).click();
  await saved(page);
  state = await readSnapshot(page);
  const evaluation = state.evaluation;
  expect(state.evaluationAttempts).toHaveLength(3);
  expect(
    state.completions.filter((c: any) => c.lessonId === "L004"),
  ).toHaveLength(1);
  expect(state.progress).toEqual(old.progress);
  await page.getByRole("button", { name: "← 戻る・途中終了" }).click();
  await page.getByRole("button", { name: "ホーム", exact: true }).click();
  await page.getByRole("button", { name: "第0章を見る", exact: true }).click();
  await page.getByRole("button", { name: "第1話で、AIの学び方を試す" }).click();
  await expect(page.locator(".shipping-verdicts")).toContainText(
    "AIの判定：良品",
  );
  await page.getByRole("button", { name: "← 戻る・途中終了" }).click();
  await page.getByRole("button", { name: "最初から学ぶ" }).click();
  await saved(page);
  expect((await readSnapshot(page)).evaluation).toEqual(evaluation);
  expect((await readSnapshot(page)).evaluationAttempts).toHaveLength(3);
  expect((await readSnapshot(page)).attempts).toEqual(old.attempts);
  await page.getByRole("button", { name: "仕分け台へ行く" }).click();
  await page.getByRole("button", { name: "最初の箱を流す" }).click();
  await page
    .getByRole("button", { name: "検査済みの箱を見本に加える" })
    .click();
  await finishEpisode(page);
  await expect(
    page.getByRole("button", { name: "ここで終える" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "試験問題で確認する" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "第2話を開く" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "翌朝、出荷ラインで試運転。",
  );
});

test("オフラインで第2話の導入から結末・完了、再読込後の再開も可能", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await context.setOffline(true);
  await page.reload();
  await open(page);
  await runToEnd(page);
  await shot(page, "evaluation-ending-offline");
  await page.getByRole("button", { name: "ここで終える" }).click();
  await saved(page);
  await page.reload();
  await open(page);
  await expect(page.locator(".evaluation-terms")).toContainText("再現率");
  await expect(page.getByText("オフライン", { exact: true })).toBeVisible();
  expect((await readSnapshot(page)).evaluation.completed).toBe(true);
  await context.setOffline(false);
});

for (const large of [false, true])
  test(
    "320px：導入・比較・用語・表が切れずに完了／拡大=" + large,
    async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 740 });
      await page.goto("/");
      await open(page);
      if (large)
        await page.addStyleTag({
          content:
            ".evaluation-lesson{font-size:32px}.evaluation-lesson h1,.evaluation-lesson h2,.evaluation-lesson h3,.evaluation-lesson p,.evaluation-lesson button,.evaluation-verdicts,.evaluation-headline span,.evaluation-terms article{font-size:inherit!important}",
        });
      const check = async () => {
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        for (const item of await page
          .locator(
            ".evaluation-lesson button:visible,.evaluation-comparison,.evaluation-matrix:visible,.evaluation-terms article",
          )
          .all()) {
          const b = await item.boundingBox();
          expect(b!.x).toBeGreaterThanOrEqual(0);
          expect(b!.x + b!.width).toBeLessThanOrEqual(320);
        }
        const image = await page
          .locator(".shipping-illustration")
          .boundingBox();
        const line = page.locator(".inspector-line");
        if (await line.count()) {
          const b = await line.boundingBox();
          expect(image!.y + image!.height).toBeLessThanOrEqual(b!.y);
        }
      };
      await check();
      await page.getByRole("button", { name: "100箱を流す" }).click();
      await check();
      await page.getByRole("button", { name: "別の仕分け設定で試す" }).click();
      await check();
      await shot(
        page,
        large
          ? "evaluation-comparison-large-text"
          : "evaluation-comparison-320",
      );
      await page
        .getByRole("button", { name: "見るべき数字を振り返る" })
        .click();
      await check();
      await page.getByText("詳しく見る：混同行列", { exact: true }).click();
      await check();
      await shot(
        page,
        large ? "evaluation-ending-large-text" : "evaluation-ending-320",
      );
      await page.getByRole("button", { name: "ここで終える" }).click();
      await saved(page);
      expect((await readSnapshot(page)).evaluation.completed).toBe(true);
    },
  );
