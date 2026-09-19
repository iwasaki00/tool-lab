import { expect, test } from "@playwright/test";
import { monitorErrors, openLab, screenshot, startGame } from "./helpers";

test("Exploration", async ({ page }) => {
  const monitor = monitorErrors(page); await openLab(page); await startGame(page, "EXPLORATION"); await screenshot(page, "exploration/01-start.png");
  expect((await page.evaluate(() => window.__SPACE_LAB_TEST__!.getEnemyStates())).enemyCount).toBe(0);
  const rooms = (await page.evaluate(() => window.__SPACE_LAB_TEST__!.getWorldState())).rooms;
  if (rooms.length) { await page.evaluate((id) => window.__SPACE_LAB_TEST__!.teleportTo(id), rooms[0].id); await page.waitForTimeout(200); }
  await page.evaluate(() => window.__SPACE_LAB_TEST__!.discover("current")); const first = await page.evaluate(() => window.__SPACE_LAB_TEST__!.getDiscoveryState());
  await page.evaluate(() => window.__SPACE_LAB_TEST__!.discover("current")); const duplicate = await page.evaluate(() => window.__SPACE_LAB_TEST__!.getDiscoveryState()); expect(duplicate.discovered).toBe(first.discovered);
  await screenshot(page, "exploration/02-discovery.png"); await page.evaluate(() => window.__SPACE_LAB_TEST__!.discover("all"));
  const complete = await page.evaluate(() => window.__SPACE_LAB_TEST__!.getDiscoveryState()); expect(complete.discovered).toBeGreaterThanOrEqual(complete.target); expect(complete.buildingsVisited).toBeGreaterThanOrEqual(complete.buildingTarget); expect(complete.landmarkFound).toBeTruthy();
  await screenshot(page, "exploration/03-progress.png"); await page.waitForFunction(() => window.__SPACE_LAB_TEST__?.getGameState().session?.state === "COMPLETE"); await screenshot(page, "exploration/04-result.png");
  expect(await page.locator("#result-screen").evaluate((node) => node.classList.contains("is-visible"))).toBeTruthy(); monitor.assertClean(); console.log("[EXPLORATION] PASS");
});
