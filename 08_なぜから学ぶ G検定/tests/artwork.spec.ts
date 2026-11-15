import { test, expect } from "@playwright/test";
import { firstBox, readSnapshot, saved } from "./helpers";
import { shippingPrediction } from "../src/engine/shippingStory";
const shot = (name: string) =>
  `docs/screenshots/v0.1.7/${name}-${test.info().project.name}.png`;
for (const width of [390, 320])
  test(`${width}px：第0章の基準絵から3コマ、誤判定と再判定まで同じ工場で進む`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    await page.getByRole("button", { name: "3分で全体像を見る" }).click();
    if (width === 390)
      for (const id of ["guide-ml", "guide-dl"])
        await page
          .locator("#" + id)
          .screenshot({ path: shot("reference-" + id) });
    await page
      .getByRole("button", { name: "第1話で、AIの学び方を試す" })
      .click();
    for (let i = 0; i < 3; i++) {
      const panel = page.locator(".comic-panel").nth(i);
      const img = panel.locator(".pixel-prologue img");
      expect(
        await img.evaluate(
          (i: HTMLImageElement) => i.complete && i.naturalWidth > 0,
        ),
      ).toBe(true);
      await expect(img).toHaveAttribute("src", /illustrations\/l003\//);
      await expect(panel).toContainText("集荷 16:00");
      if (i === 2) await expect(panel).toContainText("現在 15:00");
      await panel.screenshot({ path: shot(`opening-${i + 1}-${width}`) });
    }
    await page.getByRole("button", { name: "仕分け台へ行く" }).click();
    await expect(page.locator(".pixel-sorting-canvas")).toHaveAttribute(
      "data-verdict",
      "未判定",
    );
    await page.screenshot({ path: shot(`trial-${width}`), fullPage: true });
    await page.getByRole("button", { name: "最初の箱を流す" }).click();
    const canvas = page.locator(".pixel-sorting-canvas");
    const background = await canvas
      .locator("[data-layer=background]")
      .getAttribute("href");
    const box = canvas.locator("[data-box=Q]");
    const before = await box.getAttribute("transform");
    const sprite = await box.locator("image").getAttribute("href");
    await expect(canvas).toHaveAttribute(
      "data-verdict",
      shippingPrediction(false).label,
    );
    await expect(page.locator(".shipping-verdicts")).toContainText(
      "人の検査：合格",
    );
    await page.screenshot({
      path: shot(`sorting-before-${width}`),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "検査済みの箱を見本に加える" })
      .click();
    await saved(page);
    await expect(canvas).toHaveAttribute(
      "data-verdict",
      shippingPrediction(true).label,
    );
    expect(await box.getAttribute("transform")).not.toBe(before);
    expect(await box.locator("image").getAttribute("href")).toBe(sprite);
    expect(
      await canvas.locator("[data-layer=background]").getAttribute("href"),
    ).toBe(background);
    await expect(page.locator(".pixel-sorting figcaption")).toContainText(
      "箱W：検査済みの良品／見本に追加済み",
    );
    const q = await box.boundingBox();
    for (const tag of await page.locator(".pixel-lane").all()) {
      const b = await tag.boundingBox();
      expect(
        q!.x + q!.width <= b!.x ||
          b!.x + b!.width <= q!.x ||
          q!.y + q!.height <= b!.y ||
          b!.y + b!.height <= q!.y,
      ).toBe(true);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: shot(`sorting-after-${width}`),
      fullPage: true,
    });
    expect((await readSnapshot(page)).attempts).toEqual([]);
  });

test("新規PNGはローカル・箱は透明部品、オフラインで再開・最初からも動く", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await expect(page.getByText("オフライン教材：準備済み")).toBeVisible({
    timeout: 20000,
  });
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  await firstBox(page);
  const assets = [
    "usual-shipping",
    "packaging-stopped",
    "boxes-arriving",
    "sorting-background",
    "box-sprite",
  ];
  for (const asset of assets)
    expect(
      await page.evaluate(
        async (asset) =>
          (await fetch("./illustrations/l003/" + asset + ".png")).ok,
        asset,
      ),
    ).toBe(true);
  expect(
    await page.evaluate(async () => {
      const img = new Image();
      img.src = "./illustrations/l003/box-sprite.png";
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const x = c.getContext("2d")!;
      x.drawImage(img, 0, 0);
      return x.getImageData(0, 0, 1, 1).data[3];
    }),
  ).toBe(0);
  await page
    .getByRole("button", { name: "検査済みの箱を見本に加える" })
    .click();
  await saved(page);
  const before = await readSnapshot(page);
  await page.reload();
  await page.getByRole("button", { name: "続きから学ぶ" }).click();
  await expect(page.locator(".pixel-sorting-canvas")).toHaveAttribute(
    "data-verdict",
    "良品",
  );
  await page.getByRole("button", { name: "← 戻る・途中終了" }).click();
  await page.getByRole("button", { name: "最初から学ぶ" }).click();
  await saved(page);
  await expect(page.locator(".pixel-prologue img")).toHaveCount(3);
  await page.getByRole("button", { name: "仕分け台へ行く" }).click();
  await page.getByRole("button", { name: "最初の箱を流す" }).click();
  await expect(page.locator(".pixel-sorting-canvas")).toHaveAttribute(
    "data-verdict",
    "不良",
  );
  expect((await readSnapshot(page)).attempts).toEqual(before.attempts);
  await context.setOffline(false);
});
