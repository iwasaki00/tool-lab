import { expect, test } from "@playwright/test";
import { monitorErrors, openLab, screenshot, startGame } from "./helpers";

test("Stealth", async ({ page }) => {
  const monitor = monitorErrors(page); await openLab(page); await startGame(page, "STEALTH");
  let enemies = await page.evaluate(() => window.__SPACE_LAB_TEST__!.getEnemyStates()); expect(enemies.enemyCount).toBeGreaterThan(0); await screenshot(page, "stealth/01-patrol.png");
  await page.evaluate(() => { window.__SPACE_LAB_TEST__!.setEnemyAI(true); window.__SPACE_LAB_TEST__!.enemyCommand("player-near"); window.__SPACE_LAB_TEST__!.enemyCommand("force-detected"); });
  await page.waitForFunction(() => (window.__SPACE_LAB_TEST__?.getEnemyStates().detection ?? 0) >= .99);
  enemies = await page.evaluate(() => window.__SPACE_LAB_TEST__!.getEnemyStates()); expect(enemies.detection).toBeGreaterThanOrEqual(.99); expect(["ALERT", "CHASE"]).toContain(enemies.enemies[0]?.state); await screenshot(page, "stealth/02-detected.png");
  await page.evaluate(() => window.__SPACE_LAB_TEST__!.enemyCommand("CHASE")); expect((await page.evaluate(() => window.__SPACE_LAB_TEST__!.getEnemyStates())).enemies[0]?.state).toBe("CHASE"); await screenshot(page, "stealth/03-chase.png");
  await page.evaluate(() => { window.__SPACE_LAB_TEST__!.teleportToStart(); window.__SPACE_LAB_TEST__!.enemyCommand("clear-detection"); }); await page.waitForFunction(() => (window.__SPACE_LAB_TEST__?.getEnemyStates().detectionInfo?.level ?? 1) < .35);
  enemies = await page.evaluate(() => window.__SPACE_LAB_TEST__!.getEnemyStates()); expect(["RETURN", "PATROL"]).toContain(enemies.enemies[0]?.state); await screenshot(page, "stealth/04-return.png");
  await page.evaluate(() => window.__SPACE_LAB_TEST__!.completeMission()); await page.waitForFunction(() => window.__SPACE_LAB_TEST__?.getGameState().session?.state === "COMPLETE");
  expect((await page.evaluate(() => window.__SPACE_LAB_TEST__!.getMissionState())).complete).toBeTruthy(); monitor.assertClean(); console.log("[STEALTH] PASS");
});
