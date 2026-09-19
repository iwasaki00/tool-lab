import { expect, test } from "@playwright/test";
import { demoStep, monitorErrors, openLab, screenshot, startGame, waitForMissionAdvance } from "./helpers";

test("Demonstration", async ({ page }) => {
  const monitor = monitorErrors(page); await openLab(page, true); await demoStep(page, 1, 7, "START GAME"); await startGame(page, "ESCAPE"); await demoStep(page, 2, 7, "WORLD READY");
  for (let guard = 0; guard < 20; guard += 1) {
    const mission = await page.evaluate(() => window.__SPACE_LAB_TEST__!.getMissionState()); if (mission.complete) break; const step = mission.current; expect(step).toBeTruthy();
    const label = step.type === "FIND_ITEM" ? "KEY / ITEM ACQUISITION" : step.type === "OPEN_DOOR" ? "DOOR UNLOCK" : step.type === "ACTIVATE_SWITCH" ? "SWITCH" : step.type === "REACH_GOAL" ? "GOAL" : step.description;
    await demoStep(page, Math.min(6, guard + 3), 7, label); await page.evaluate(() => { window.__SPACE_LAB_TEST__!.teleportToObjective(); window.__SPACE_LAB_TEST__!.giveMissionItem("ALL"); }); await page.waitForTimeout(650);
    await page.evaluate(() => window.__SPACE_LAB_TEST__!.completeCurrentObjective()); await waitForMissionAdvance(page, step.id);
  }
  await page.waitForFunction(() => window.__SPACE_LAB_TEST__?.getGameState().session?.state === "COMPLETE"); await demoStep(page, 7, 7, "MISSION COMPLETE", 1300); await screenshot(page, "demo/result.png"); await page.evaluate(() => window.__SPACE_LAB_TEST__!.clearDemoStep()); monitor.assertClean(); console.log("[DEMO] PASS");
});
