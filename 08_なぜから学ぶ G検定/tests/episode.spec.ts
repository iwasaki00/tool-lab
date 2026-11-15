import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { firstBox, finishEpisode, saved, readSnapshot } from "./helpers";
import { groupTransport, compareTransport } from "../src/engine/episode";
const shot = async (page: Page, name: string) =>
  page.screenshot({
    path: `docs/screenshots/v0.1.7/${name}-${test.info().project.name}.png`,
    fullPage: true,
  });
const heading = async (page: Page, text: string) =>
  expect(page.getByRole("heading", { level: 1 })).toHaveText(text);
const oneAction = async (page: Page) =>
  expect(page.locator(".scene-body button:visible")).toHaveCount(1);
const noInputs = async (page: Page) =>
  expect(page.locator("input:visible,select:visible")).toHaveCount(0);

test("390px：専門知識・クイズ・詳細設定なしで3方式を体験し16時の出荷で終える", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByText(
      "G検定って何を学ぶ試験？ AI・機械学習・ディープラーニングの違いから見てみましょう",
      { exact: true },
    ),
  ).toBeVisible();
  await shot(page, "episode-home");
  await firstBox(page);
  await oneAction(page);
  await noInputs(page);
  await expect(page.locator(".shipping-verdicts")).toContainText(
    "AIの判定：不良",
  );
  await expect(page.getByText("教師あり学習", { exact: false })).toHaveCount(0);
  await page
    .getByRole("button", { name: "検査済みの箱を見本に加える" })
    .click();
  await saved(page);
  await expect(page.locator(".shipping-discovery")).toContainText(
    "人が付けた答えを見本にして、新しい箱を判定する。これが教師あり学習の例です",
  );
  await shot(page, "episode-supervised");
  await page.getByRole("button", { name: "搬送の様子を見る" }).click();
  await heading(page, "仕分けた箱が、なかなか届かない。");
  await oneAction(page);
  await noInputs(page);
  await expect(page.locator(".record-cloud span")).toHaveCount(12);
  await expect(page.getByText("教師なし学習", { exact: false })).toHaveCount(0);
  await page.getByRole("button", { name: "似た搬送記録をまとめる" }).click();
  await saved(page);
  for (const group of groupTransport().groups) {
    const card = page.locator(`[data-group="${group.id}"]`);
    expect(
      (await card.locator(".record-cloud span").allTextContents()).map((s) =>
        s.trim(),
      ),
    ).toEqual(group.records.map((r) => r.id));
  }
  await expect(page.locator(".episode-result")).toContainText(
    "原因は、現場で確かめます",
  );
  await expect(page.locator(".episode-result")).toContainText("教師なし学習");
  await noInputs(page);
  await shot(page, "episode-unsupervised");
  await page.getByRole("button", { name: "別の搬送経路を試す" }).click();
  await heading(page, "速い近道と、箱が揺れにくい遠回り。");
  await oneAction(page);
  await noInputs(page);
  await expect(page.getByText("強化学習", { exact: false })).toHaveCount(0);
  await page.getByRole("button", { name: "2つの運び方を比べる" }).click();
  await expect(page.locator(".route-total")).toHaveText(
    compareTransport("speed").map((s) => s.total + "点"),
  );
  await expect(page.locator('[data-route="A"]')).toContainText("合計点が高い");
  await expect(page.locator(".episode-demo")).toContainText(
    "学習した結果ではありません",
  );
  await expect(page.locator(".episode-result")).toContainText("強化学習");
  await shot(page, "episode-rewards-speed");
  await page
    .getByRole("button", { name: "箱を丁寧に運ぶ", exact: true })
    .click();
  await saved(page);
  await expect(page.locator(".route-total")).toHaveText(
    compareTransport("care").map((s) => s.total + "点"),
  );
  await expect(page.locator('[data-route="B"]')).toContainText("合計点が高い");
  await shot(page, "episode-rewards-care");
  await page.getByRole("button", { name: "出荷を見届ける" }).click();
  await heading(page, "トラックが来た。");
  await expect(page.locator(".episode-ending svg")).toContainText("集荷 16:00");
  await expect(page.locator(".episode-recap section")).toHaveCount(3);
  for (const clue of [
    "答え付きの見本",
    "答えのない記録",
    "行動の結果に付く点数",
  ])
    await expect(page.locator(".episode-recap")).toContainText(clue);
  await expect(page.locator("details[open]")).toHaveCount(0);
  await noInputs(page);
  await shot(page, "episode-ending");
  await page.getByRole("button", { name: "ここで終える" }).click();
  await saved(page);
  await expect(page.locator(".stats-row article").first()).toContainText(
    "3 / 3 方式",
  );
  const data = await readSnapshot(page);
  expect(data.attempts).toHaveLength(0);
  expect(data.progress.completed).toBe(true);
  expect(data.completions).toHaveLength(1);
  expect(data.progress.visited).toEqual([0]);
  await page.reload();
  await page.getByRole("button", { name: "続きから学ぶ" }).click();
  await heading(page, "トラックが来た。");
  await page.getByRole("button", { name: "試験問題で確認する" }).click();
  await expect(page.getByRole("radio")).toHaveCount(4);
  expect(errors).toEqual([]);
});

test("搬送記録の操作前後・条件切替後を再開し、最初から学ぶで今回の3体験だけ初期化", async ({
  page,
}) => {
  await page.goto("/");
  await firstBox(page);
  await page
    .getByRole("button", { name: "検査済みの箱を見本に加える" })
    .click();
  await page.getByRole("button", { name: "搬送の様子を見る" }).click();
  await saved(page);
  const resume = async () => {
    await page.reload();
    await page.getByRole("button", { name: "続きから学ぶ" }).click();
  };
  await resume();
  await expect(page.locator(".episode-records")).toBeVisible();
  await oneAction(page);
  await page.getByRole("button", { name: "似た搬送記録をまとめる" }).click();
  await saved(page);
  await resume();
  await expect(page.locator(".record-group")).toHaveCount(3);
  await page.getByRole("button", { name: "別の搬送経路を試す" }).click();
  await saved(page);
  await resume();
  await oneAction(page);
  await page.getByRole("button", { name: "2つの運び方を比べる" }).click();
  await page
    .getByRole("button", { name: "箱を丁寧に運ぶ", exact: true })
    .click();
  await saved(page);
  await resume();
  await expect(
    page.getByRole("button", { name: "箱を丁寧に運ぶ", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".route-total")).toHaveText(["26点", "38点"]);
  // Optional detail calculation is accessible, with per-action totals.
  await page.getByText("仕組みを詳しく見る", { exact: true }).click();
  const rows = page.locator(".episode-table").first().locator("tbody tr");
  const frames = compareTransport("care")[0].frames;
  await expect(rows).toHaveCount(frames.length);
  for (let i = 0; i < frames.length; i++)
    await expect(rows.nth(i).locator("td").last()).toHaveText(
      String(frames[i].total),
    );
  await page.getByRole("button", { name: "← 戻る・途中終了" }).click();
  await page.getByRole("button", { name: "最初から学ぶ" }).click();
  await saved(page);
  const b = await readSnapshot(page);
  expect(b.progress.episode).toEqual({
    stage: "sorting",
    grouped: false,
    compared: false,
    priority: "speed",
  });
  await page.getByRole("button", { name: "仕分け台へ行く" }).click();
  await page.getByRole("button", { name: "最初の箱を流す" }).click();
  await expect(page.locator(".shipping-verdicts")).toContainText(
    "AIの判定：不良",
  );
  await page
    .getByRole("button", { name: "検査済みの箱を見本に加える" })
    .click();
  await page.getByText("仕組みを詳しく見る", { exact: true }).click();
  await page.getByRole("button", { name: "詳しい分類教材へ" }).click();
  await page.getByRole("button", { name: "出荷の物語に戻る" }).click();
  await expect(page.locator(".shipping-verdicts")).toContainText(
    "AIの判定：良品",
  );
  await page.getByRole("button", { name: "搬送の様子を見る" }).click();
  await expect(page.locator(".episode-records")).toBeVisible();
});

test("オフラインで漫画から出荷・振り返り・完了まで通し、完了記録を再開する", async ({
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
  await firstBox(page);
  await page
    .getByRole("button", { name: "検査済みの箱を見本に加える" })
    .click();
  await finishEpisode(page);
  await shot(page, "episode-ending-offline");
  await page.getByRole("button", { name: "ここで終える" }).click();
  await saved(page);
  await page.reload();
  await page.getByRole("button", { name: "続きから学ぶ" }).click();
  await expect(page.locator(".episode-recap section")).toHaveCount(3);
  await expect(page.getByText("オフライン", { exact: true })).toBeVisible();
  expect((await readSnapshot(page)).completions).toHaveLength(1);
  await context.setOffline(false);
});

for (const large of [false, true])
  test("320px全編に切れや重なりがない／文字拡大=" + large, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 740 });
    await page.goto("/");
    if (large)
      await page.addStyleTag({
        content:
          ".story-intro{font-size:32px}.story-intro h1,.story-intro h2,.story-intro h3,.story-intro p,.story-intro button,.inspector-line>span,.record-cloud span{font-size:inherit!important}",
      });
    const check = async () => {
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const items = await page
        .locator(
          ".scene-body button:visible,.episode-result:visible,.route-score:visible,.episode-recap section:visible",
        )
        .all();
      for (const item of items) {
        const box = await item.boundingBox();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(320);
      }
      for (const card of await page
        .locator(".episode-scene,.shipping-story")
        .all()) {
        const image = card.locator(":scope > svg");
        const line = card.locator(":scope > .inspector-line");
        if ((await image.count()) && (await line.count())) {
          const a = await image.boundingBox(),
            b = await line.boundingBox();
          expect(a!.y + a!.height).toBeLessThanOrEqual(b!.y);
        }
      }
    };
    await page.getByRole("button", { name: "3分で全体像を見る" }).click();
    await page
      .getByRole("button", { name: "第1話で、AIの学び方を試す" })
      .click();
    await check();
    for (const action of [
      "仕分け台へ行く",
      "最初の箱を流す",
      "検査済みの箱を見本に加える",
      "搬送の様子を見る",
      "似た搬送記録をまとめる",
      "別の搬送経路を試す",
      "2つの運び方を比べる",
      "箱を丁寧に運ぶ",
      "出荷を見届ける",
    ]) {
      await page.getByRole("button", { name: action, exact: true }).click();
      await check();
    }
    await shot(
      page,
      large ? "episode-ending-large-text" : "episode-ending-320",
    );
    await page.getByRole("button", { name: "ここで終える" }).click();
    await saved(page);
    expect((await readSnapshot(page)).progress.completed).toBe(true);
  });
