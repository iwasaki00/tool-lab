import { expect, test } from "@playwright/test";
import { monitorErrors, openLab, startGame } from "./helpers";

test("Stability", async ({ page }) => {
  const monitor = monitorErrors(page); await openLab(page);
  const seeds = [
    { citySeed: 91357, missionSeed: 48271 },
    { citySeed: 246813, missionSeed: 97531 },
    { citySeed: 702401, missionSeed: 315799 },
  ];
  for (const seed of seeds) {
    await startGame(page, "ESCAPE", seed); const state = await page.evaluate(() => window.__SPACE_LAB_TEST__!.getGameState()); const mission = await page.evaluate(() => window.__SPACE_LAB_TEST__!.getMissionState()); const validation = await page.evaluate(() => window.__SPACE_LAB_TEST__!.getMissionValidation());
    expect(state.session?.state).toBe("PLAYING"); expect(validation.valid, validation.errors?.join(" / ")).toBeTruthy(); expect(mission.current).toBeTruthy(); expect(mission.plan.goal.id).toBeTruthy(); console.log(`[STABILITY] PASS city=${seed.citySeed} mission=${seed.missionSeed}`);
  }
  monitor.assertClean();
});
