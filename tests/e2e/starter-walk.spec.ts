import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

test("Starter template runs through Public API only", async ({ page }) => {
  const sources = ["appConfig.ts", "appComposition.ts", "main.ts"].map((file) => readFileSync(resolve("06_3D空間実験室/templates/starter-3d", file), "utf8")).join("\n");
  expect(sources).toContain("src/framework/index");
  expect(sources).not.toMatch(/framework\/internal|src\/game\/sample|LaboratoryApi|NavigationManager|WorldMapManager|VisualManager/);
  await page.goto("/templates/starter-3d/index.html");
  await page.waitForFunction(() => document.documentElement.dataset.starterReady === "true");
  await expect(page.locator("#app-canvas")).toBeVisible();
  await expect(page.locator("#feature-profile")).toHaveText("MINIMAL");
  await page.locator("#night").click();
  await expect(page.locator("#error")).toBeHidden();
});

test("3D Walk Sample desktop movement, streaming, visual and interaction", async ({ page }) => {
  const sources = ["appConfig.ts", "main.ts"].map((file) => readFileSync(resolve("06_3D空間実験室/examples/3d-walk", file), "utf8")).join("\n");
  expect(sources).toContain("src/framework/index");
  expect(sources).not.toMatch(/framework\/internal|src\/game\/sample|LaboratoryApi|NavigationManager|WorldMapManager|VisualManager/);
  await page.goto("/examples/3d-walk/index.html");
  await page.waitForFunction(() => document.documentElement.dataset.walkReady === "true");
  await expect(page.locator("#walk-canvas")).toBeVisible();
  const initial = await page.evaluate(() => (window as any).__WALK_SAMPLE__.framework.getMap().snapshot());
  expect(initial.mode).toBe("PROCEDURAL");
  const before = await page.evaluate(() => (window as any).__WALK_SAMPLE__.framework.getPlayer().getPosition().asArray());
  await page.keyboard.down("KeyW"); await page.waitForTimeout(450); await page.keyboard.up("KeyW");
  const after = await page.evaluate(() => (window as any).__WALK_SAMPLE__.framework.getPlayer().getPosition().asArray());
  expect(after).not.toEqual(before);
  await page.evaluate(() => (window as any).__WALK_SAMPLE__.moveNearEastBoundary());
  await page.waitForFunction((count) => (window as any).__WALK_SAMPLE__.framework.getMap().snapshot().totalChunks > count, initial.totalChunks);
  await page.locator('[data-environment="NIGHT"]').click();
  expect(await page.evaluate(() => (window as any).__WALK_SAMPLE__.framework.getVisual().getState().environment)).toBe("NIGHT");
  await page.locator("#interact-button").click();
  expect(await page.evaluate(() => (window as any).__WALK_SAMPLE__.interactionCount())).toBe(1);
});

test("3D Walk Sample mobile controls", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
  const page = await context.newPage();
  await page.goto("/examples/3d-walk/index.html");
  await page.waitForFunction(() => document.documentElement.dataset.walkReady === "true");
  await expect(page.locator("#walk-canvas")).toBeVisible();
  await expect(page.locator("#joystick")).toBeVisible();
  await expect(page.locator("#jump-button")).toBeVisible();
  await expect(page.locator("#mobile-interact-button")).toBeVisible();
  const safety = await page.locator("#walk-canvas").evaluate((element) => ({ touchAction: getComputedStyle(element).touchAction, userSelect: getComputedStyle(element).userSelect }));
  expect(safety.touchAction).toBe("none"); expect(safety.userSelect).toBe("none");
  await page.locator("#mobile-interact-button").tap();
  expect(await page.evaluate(() => (window as any).__WALK_SAMPLE__.interactionCount())).toBe(1);
  await context.close();
});
