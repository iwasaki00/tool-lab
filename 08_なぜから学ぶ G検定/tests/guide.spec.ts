import { test, expect, type Page } from "@playwright/test";
import { firstBox, saved, readSnapshot } from "./helpers";
const chapter = (page: Page) => page.locator(".beginner-guide");
const shot = async (page: Page, name: string) =>
  page.screenshot({
    path: `docs/screenshots/v0.1.6/${name}-${test.info().project.name}.png`,
    fullPage: true,
  });
async function openGuide(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "3分で全体像を見る" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "G検定とAIの全体像",
  );
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}

test("新規ホーム → 第0章 → 深掘り不要で第1話、包含図は入れ子で描く", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByText(
      "G検定って何を学ぶ試験？ AI・機械学習・ディープラーニングの違いから見てみましょう",
      { exact: true },
    ),
  ).toBeVisible();
  await shot(page, "guide-home-390");
  await page.getByRole("button", { name: "3分で全体像を見る" }).click();
  await expect(chapter(page).locator(".guide-section")).toHaveCount(5);
  await expect(chapter(page).locator("details[open]")).toHaveCount(0);
  await expect(chapter(page).locator("input,select")).toHaveCount(0);
  await expect(
    chapter(page).locator(
      ".ai-containment > .ml-containment > .dl-containment",
    ),
  ).toHaveCount(1);
  await expect(chapter(page)).toContainText("すべてのAIが機械学習ではなく");
  const images = chapter(page).locator("img");
  await expect(images).toHaveCount(3); // rules image exists in closed, optional deep dive
  for (const image of await images.all())
    expect(
      await image.evaluate(
        (i: HTMLImageElement) => i.complete && i.naturalWidth > 0,
      ),
    ).toBe(true);
  await noOverflow(page);
  await shot(page, "guide-overview-390");
  for (const id of ["guide-ml", "guide-dl"]) {
    await chapter(page)
      .locator("#" + id)
      .screenshot({
        path: `docs/screenshots/v0.1.6/${id}-390-${test.info().project.name}.png`,
      });
  }
  await page.getByRole("button", { name: "第1話で、AIの学び方を試す" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "今日は、いつもどおりのはずだった",
  );
  await expect(page.locator(".comic-panel")).toHaveCount(3);
  await saved(page);
  expect((await readSnapshot(page)).attempts).toEqual([]);
});

test("深掘り4項目を開閉して元のスクロール位置とフォーカスへ戻る", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openGuide(page);
  const titles = [
    "G検定の出題範囲を見る",
    "なぜ、ルールを書く以外の方法が必要だった？",
    "見本の答えがないときは、どう学ぶ？",
    "なぜ、何層も重ねるの？",
  ];
  for (const title of titles) {
    const summary = chapter(page).locator("summary").filter({ hasText: title });
    await summary.scrollIntoViewIfNeeded();
    const before = await page.evaluate(() => scrollY);
    await summary.click();
    const detail = chapter(page).locator("details[open]");
    await expect(detail).toHaveCount(1);
    if (title.startsWith("G検定"))
      await expect(detail).toContainText("全範囲を網羅する教材ではありません");
    if (title.startsWith("なぜ、ルール")) {
      await expect(detail).toContainText("1959年");
      await expect(detail).toContainText(
        "歴史上の出来事を描いたものではありません",
      );
      await detail.screenshot({
        path: `docs/screenshots/v0.1.6/guide-rules-390-${test.info().project.name}.png`,
      });
    }
    if (title.startsWith("なぜ、何層"))
      await expect(detail.locator(".feature-schematic")).toContainText(
        "理解のための模式図",
      );
    await detail
      .getByRole("button", { name: "解説を閉じて元の項目に戻る" })
      .click();
    await expect(chapter(page).locator("details[open]")).toHaveCount(0);
    await expect(summary).toBeFocused();
    await expect
      .poll(() => page.evaluate(() => scrollY))
      .toBeCloseTo(before, 0);
  }
  // Native summary toggle also restores position.
  const summary = chapter(page).locator("summary").first();
  await summary.scrollIntoViewIfNeeded();
  const before = await page.evaluate(() => scrollY);
  await summary.click();
  await summary.click();
  await expect.poll(() => page.evaluate(() => scrollY)).toBeCloseTo(before, 0);
});

test("両レッスンの操作後から第0章へ寄り道し、位置・操作・保存データを保ったまま戻る", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await firstBox(page);
  await page
    .getByRole("button", { name: "検査済みの箱を見本に加える" })
    .click();
  await saved(page);
  const before = await readSnapshot(page);
  const link = page.getByRole("button", { name: "第0章で用語を確認" });
  await link.scrollIntoViewIfNeeded();
  const y = await page.evaluate(() => scrollY);
  await link.click();
  await page.getByRole("button", { name: "← 第0章を閉じて戻る" }).click();
  await expect(page.locator(".shipping-verdicts")).toContainText(
    "AIの判定：良品",
  );
  await expect(link).toBeFocused();
  await expect.poll(() => page.evaluate(() => scrollY)).toBeCloseTo(y, 0);
  expect(await readSnapshot(page)).toEqual(before);
  await link.click();
  await page
    .getByRole("button", { name: "第2話で、AIの性能を確かめる" })
    .click();
  await page.getByRole("button", { name: "100箱を流す" }).click();
  await page.getByRole("button", { name: "別の仕分け設定で試す" }).click();
  await saved(page);
  const evaluation = await readSnapshot(page);
  await page.getByRole("button", { name: "第0章で用語を確認" }).click();
  await page
    .getByRole("button", { name: "第2話で、AIの性能を確かめる" })
    .click();
  await expect(page.locator(".evaluation-lesson")).toContainText("98％");
  expect(await readSnapshot(page)).toEqual(evaluation);
  expect(evaluation.progress).toEqual(before.progress);
});

test("漫画の読書位置を第0章のスクロールで上書きせず、ホーム・コースからいつでも開ける", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openGuide(page);
  await page.getByRole("button", { name: "第1話で、AIの学び方を試す" }).click();
  await page.locator(".comic-panel").nth(1).scrollIntoViewIfNeeded();
  await expect
    .poll(async () => (await readSnapshot(page)).progress.prologueScroll)
    .toBeGreaterThan(100);
  await page.getByRole("button", { name: "第0章で用語を確認" }).click();
  // Clicking the link can scroll the lesson to its header before opening the guide.
  // Compare with the checkpoint at guide entry, not with that earlier reading position.
  const original = (await readSnapshot(page)).progress.prologueScroll;
  await chapter(page).locator("#guide-dl").scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  expect((await readSnapshot(page)).progress.prologueScroll).toBe(original);
  await page.getByRole("button", { name: "← 第0章を閉じて戻る" }).click();
  await page.getByRole("button", { name: "← 戻る・途中終了" }).click();
  await expect(
    page.getByRole("button", { name: "続きから学ぶ" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "第0章を見る", exact: true }).click();
  await page.getByRole("button", { name: "← 第0章を閉じて戻る" }).click();
  await page.getByRole("button", { name: "コース", exact: true }).click();
  await page.getByRole("button", { name: "第0章を見る", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "G検定とAIの全体像",
  );
});

for (const large of [false, true])
  test(`320px・文字${large ? "200%" : "通常"}：図・画像・深掘り・2話の入口を読める`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 740 });
    await openGuide(page);
    if (large)
      await page.addStyleTag({
        content:
          ".beginner-guide{font-size:28px}.beginner-guide p,.beginner-guide h2,.beginner-guide button,.beginner-guide summary,.beginner-guide figcaption,.beginner-guide .image-labels,.beginner-guide .ai-containment p{font-size:inherit!important}",
      });
    await noOverflow(page);
    for (const id of ["guide-ai", "guide-ml", "guide-dl"]) {
      const section = chapter(page).locator("#" + id);
      if (large)
        await section.screenshot({
          path: `docs/screenshots/v0.1.6/${id}-320-large-${test.info().project.name}.png`,
        });
      else
        await section.screenshot({
          path: `docs/screenshots/v0.1.6/${id}-320-${test.info().project.name}.png`,
        });
      const img = section.locator("img");
      if (await img.count()) {
        const b = await img.boundingBox();
        const c = await section
          .locator(".guide-illustration figcaption")
          .boundingBox();
        expect(b!.x).toBeGreaterThanOrEqual(0);
        expect(b!.x + b!.width).toBeLessThanOrEqual(320);
        expect(b!.y + b!.height).toBeLessThanOrEqual(c!.y);
      }
    }
    await chapter(page)
      .getByText("なぜ、ルールを書く以外の方法が必要だった？", { exact: false })
      .click();
    await noOverflow(page);
    await chapter(page)
      .locator("details[open]")
      .screenshot({
        path: `docs/screenshots/v0.1.6/guide-rules-320${large ? "-large" : ""}-${test.info().project.name}.png`,
      });
    await page
      .getByRole("button", { name: "解説を閉じて元の項目に戻る" })
      .click();
    await page
      .getByRole("button", { name: "第2話で、AIの性能を確かめる" })
      .click();
    await expect(
      page.getByRole("button", { name: "100箱を流す" }),
    ).toBeVisible();
  });

test("オフラインで第0章・深掘り本文・全PNGを表示できる", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await expect(page.getByText("オフライン教材：準備済み")).toBeVisible({
    timeout: 15000,
  });
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  await page.getByRole("button", { name: "3分で全体像を見る" }).click();
  for (const summary of await chapter(page).locator("summary").all())
    await summary.click();
  await expect(chapter(page).locator("details[open]")).toHaveCount(4);
  for (const img of await chapter(page).locator("img").all()) {
    await expect(img).toBeVisible();
    expect(
      await img.evaluate(
        (i: HTMLImageElement) => i.complete && i.naturalWidth > 0,
      ),
    ).toBe(true);
    const response = await page.evaluate(
      async (url) => {
        const r = await fetch(url);
        return { ok: r.ok, type: r.headers.get("content-type") };
      },
      (await img.getAttribute("src")) as string,
    );
    expect(response.ok).toBe(true);
    expect(response.type).toContain("image/png");
  }
  await expect(chapter(page)).toContainText("アーサー・サミュエル");
  await shot(page, "guide-offline");
  await page.getByRole("button", { name: "第1話で、AIの学び方を試す" }).click();
  await expect(page.locator(".comic-panel")).toHaveCount(3);
  await context.setOffline(false);
});

test("ホームは直近の第2話を再開・やり直しし、第1話の状態を変えない", async ({
  page,
}) => {
  await page.goto("/");
  await firstBox(page);
  await page
    .getByRole("button", { name: "検査済みの箱を見本に加える" })
    .click();
  await saved(page);
  const original = (await readSnapshot(page)).progress;
  await page.getByRole("button", { name: "第0章で用語を確認" }).click();
  await page
    .getByRole("button", { name: "第2話で、AIの性能を確かめる" })
    .click();
  await page.getByRole("button", { name: "100箱を流す" }).click();
  await saved(page);
  await page.getByRole("button", { name: "← 戻る・途中終了" }).click();
  await expect(
    page.getByText("再開する教材：第2話 · モデル評価"),
  ).toBeVisible();
  await page.getByRole("button", { name: "続きから学ぶ" }).click();
  await expect(page.locator(".evaluation-verdicts")).toContainText("見逃し");
  await page.getByRole("button", { name: "← 戻る・途中終了" }).click();
  await page.getByRole("button", { name: "最初から学ぶ" }).click();
  await saved(page);
  await expect(page.getByRole("button", { name: "100箱を流す" })).toBeVisible();
  expect((await readSnapshot(page)).progress).toEqual(original);
});
