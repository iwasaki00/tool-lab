import { expect, test } from "@playwright/test";
import { monitorErrors, openLab, screenshot, startGame, waitForMissionAdvance } from "./helpers";

test("Escape", async ({ page }) => {
  const monitor = monitorErrors(page); await openLab(page); await screenshot(page, "escape/01-title.png"); await startGame(page, "ESCAPE"); await screenshot(page, "escape/02-world-ready.png");
  let keyShot = false; let doorShot = false; let switchShot = false; let goalShot = false;
  for (let guard = 0; guard < 20; guard += 1) {
    const mission = await page.evaluate(() => window.__SPACE_LAB_TEST__!.getMissionState()); if (mission.complete) break;
    const step = mission.current; expect(step, "Mission must have an active step").toBeTruthy(); const guideBefore = await page.evaluate(() => window.__SPACE_LAB_TEST__!.getGuideState());
    await page.evaluate(() => window.__SPACE_LAB_TEST__!.teleportToObjective()); await page.waitForTimeout(180);
    if (step.type === "FIND_ITEM") {
      await page.evaluate(() => window.__SPACE_LAB_TEST__!.giveMissionItem("ALL")); expect((await page.evaluate(() => window.__SPACE_LAB_TEST__!.getWorldState())).inventory.length).toBeGreaterThan(0);
      if (!keyShot) { await screenshot(page, "escape/03-key.png"); keyShot = true; } console.log("[ESCAPE] Item acquired");
    }
    if (step.type === "OPEN_DOOR") {
      await page.waitForTimeout(400); await page.evaluate((id) => { window.__SPACE_LAB_TEST__!.setDoorState(id, "UNLOCKED"); window.__SPACE_LAB_TEST__!.setDoorState(id, "OPEN"); }, step.targetIds[0]);
      const door = (await page.evaluate(() => window.__SPACE_LAB_TEST__!.getWorldState())).doors.find((item: any) => item.id === step.targetIds[0]); if (door) expect(door.state).not.toBe("LOCKED");
      if (!doorShot) { await screenshot(page, "escape/04-door.png"); doorShot = true; } console.log("[ESCAPE] Door unlocked");
    }
    if (step.type === "ACTIVATE_SWITCH") {
      await page.waitForTimeout(400); await page.evaluate((id) => window.__SPACE_LAB_TEST__!.setSwitchState(id, "ON"), step.targetIds[0]);
      const toggle = (await page.evaluate(() => window.__SPACE_LAB_TEST__!.getWorldState())).switches.find((item: any) => item.id === step.targetIds[0]); if (toggle) expect(toggle.state).toBe("ON");
      if (!switchShot) { await screenshot(page, "escape/05-switch.png"); switchShot = true; } console.log("[ESCAPE] Switch activated");
    }
    if ((step.type === "REACH_GOAL" || step.targetType === "GOAL") && !goalShot) { await screenshot(page, "escape/06-goal.png"); goalShot = true; }
    await page.evaluate(() => window.__SPACE_LAB_TEST__!.completeCurrentObjective()); await waitForMissionAdvance(page, step.id);
    const next = await page.evaluate(() => window.__SPACE_LAB_TEST__!.getMissionState()); if (!next.complete && guideBefore.targetId !== "—") expect((await page.evaluate(() => window.__SPACE_LAB_TEST__!.getGuideState())).objectiveId).not.toBe(guideBefore.objectiveId);
  }
  await page.waitForFunction(() => window.__SPACE_LAB_TEST__?.getGameState().session?.state === "COMPLETE"); expect(await page.locator("#result-screen").evaluate((node) => node.classList.contains("is-visible"))).toBeTruthy();
  await screenshot(page, "escape/07-result.png"); monitor.assertClean(); console.log("[ESCAPE] PASS");
});
