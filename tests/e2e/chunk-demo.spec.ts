import { expect, test } from "@playwright/test";
import { demoStep, monitorErrors, openLab, screenshot, startGame } from "./helpers";

test("Chunk Demonstration", async ({ page }) => {
  const monitor = monitorErrors(page); await openLab(page, true); await demoStep(page, 1, 5, "PROCEDURAL WORLD"); await startGame(page, "ESCAPE");
  await page.evaluate(() => { window.__SPACE_LAB_TEST__!.setChunkUnload(false); window.__SPACE_LAB_TEST__!.setAutoExpansion(true); }); await demoStep(page, 2, 5, "MOVE TO CHUNK EDGE");
  await page.evaluate(() => window.__SPACE_LAB_TEST__!.teleportNearChunkEdge("east")); await demoStep(page, 3, 5, "GENERATING AREA...", 1300); await page.waitForFunction(() => window.__SPACE_LAB_TEST__!.getMapState().totalChunks > 1);
  await page.evaluate(() => window.__SPACE_LAB_TEST__!.teleportNearChunkEdge("east", true)); await page.waitForFunction(() => window.__SPACE_LAB_TEST__!.getCurrentChunk().x === 1); await demoStep(page, 4, 5, "ENTER NEW CHUNK", 1200); await screenshot(page, "chunks/demo-new-area.png");
  expect((await page.evaluate(() => window.__SPACE_LAB_TEST__!.getMapState())).loadedChunks).toContain("chunk_1_0"); await demoStep(page, 5, 5, "CHUNK STREAMING READY"); await page.evaluate(() => window.__SPACE_LAB_TEST__!.clearDemoStep()); monitor.assertClean(); console.log("[CHUNK DEMO] PASS");
});
