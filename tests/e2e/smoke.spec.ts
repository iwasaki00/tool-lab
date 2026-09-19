import { expect, test } from "@playwright/test";
import { FIXED_SEEDS, monitorErrors, openLab, screenshot, startGame } from "./helpers";

test("Smoke", async ({ page }) => {
  const monitor = monitorErrors(page); await openLab(page); await screenshot(page, "smoke/01-title.png");
  const initial = await page.evaluate(() => window.__SPACE_LAB_TEST__!.getGameState());
  expect(initial.sceneReady).toBeTruthy(); expect(initial.playerReady).toBeTruthy(); expect(initial.canvas.clientWidth).toBeGreaterThan(0); expect(initial.canvas.clientHeight).toBeGreaterThan(0);
  await startGame(page, "ESCAPE", FIXED_SEEDS);
  const state = await page.evaluate(() => window.__SPACE_LAB_TEST__!.getGameState());
  expect(state.session?.state).toBe("PLAYING"); expect(["READY", "FALLBACK"]).toContain(state.navigation.status); expect(["NAVMESH", "WORLD_GRAPH", "DIRECT_FALLBACK"]).toContain(state.navigation.mode);
  expect(state.generationError).toBeFalsy(); expect((await page.evaluate(() => window.__SPACE_LAB_TEST__!.getMissionState())).plan.goal.id).toBeTruthy();
  await screenshot(page, "smoke/02-world-ready.png"); monitor.assertClean(); console.log("[SMOKE] PASS");
});
