import { expect, test } from "@playwright/test";
import { monitorErrors, openLab, screenshot, startGame } from "./helpers";

test("Mobile UI", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 }); const page = await context.newPage(); const monitor = monitorErrors(page);
  await openLab(page); await expect(page.locator("#game-title-screen")).toBeVisible(); await expect(page.locator("#start-game-button")).toBeInViewport(); await startGame(page, "ESCAPE");
  const state = await page.evaluate(() => window.__SPACE_LAB_TEST__!.getGameState()); expect(state.canvas.clientWidth).toBeGreaterThan(0); expect(state.canvas.clientHeight).toBeGreaterThan(0);
  await expect(page.locator("#joystick")).toBeAttached(); await expect(page.locator("#jump-button")).toBeAttached(); await screenshot(page, "mobile/01-world.png"); monitor.assertClean(); await context.close(); console.log("[MOBILE UI] PASS");
});
