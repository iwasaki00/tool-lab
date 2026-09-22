import { expect, test } from "@playwright/test";
import { monitorErrors, openLab, screenshot, startGame } from "./helpers";

test("Visual System presets, quality and chunk reload", async ({ page }) => {
  test.setTimeout(180_000);
  const monitor = monitorErrors(page); await openLab(page); await startGame(page, "ESCAPE");
  for (const preset of ["CLEAR_DAY", "CLOUDY", "SUNSET", "NIGHT", "FOGGY"] as const) { await page.evaluate((value) => window.__SPACE_LAB_TEST__!.setEnvironmentPreset(value), preset); await page.waitForTimeout(300); const state = await page.evaluate(() => window.__SPACE_LAB_TEST__!.getVisualState()); expect(state.environment).toBe(preset); if (preset === "FOGGY") expect(state.fog).toBe("HEAVY"); await screenshot(page, `visual/${preset.toLowerCase()}.png`); }
  for (const quality of ["AUTO", "LOW", "MEDIUM", "HIGH"] as const) { await page.evaluate((value) => window.__SPACE_LAB_TEST__!.setVisualQuality(value), quality); await page.waitForTimeout(250); const state = await page.evaluate(() => window.__SPACE_LAB_TEST__!.getVisualState()); expect(state.resolvedQuality).toBe(quality === "AUTO" ? "MEDIUM" : quality); expect(state.materials).toBeGreaterThan(0); expect(state.activeLights).toBeGreaterThan(0); await screenshot(page, `visual/quality-${quality.toLowerCase()}.png`); }
  await page.evaluate(() => { window.__SPACE_LAB_TEST__!.setVisualQuality("MEDIUM"); window.__SPACE_LAB_TEST__!.setChunkUnload(true); window.__SPACE_LAB_TEST__!.setAutoExpansion(true); window.__SPACE_LAB_TEST__!.teleportNearChunkEdge("east"); }); await page.waitForFunction(() => window.__SPACE_LAB_TEST__!.getMapState().totalChunks > 1);
  const exportedBefore = await page.evaluate(() => window.__SPACE_LAB_TEST__!.exportMap()); const east = exportedBefore.chunks.find((item: any) => item.id === "chunk_1_0"); expect(east).toBeTruthy();
  for (let index = 0; index < 5; index += 1) { await page.evaluate(() => window.__SPACE_LAB_TEST__!.teleportNearChunkEdge("east")); await page.waitForTimeout(120); await page.evaluate(() => window.__SPACE_LAB_TEST__!.teleportNearChunkEdge("east", true)); await page.waitForTimeout(180); }
  for (let index = 0; index < 5; index += 1) { await page.evaluate(() => window.__SPACE_LAB_TEST__!.teleportNearChunkEdge("west")); await page.waitForTimeout(120); await page.evaluate(() => window.__SPACE_LAB_TEST__!.teleportNearChunkEdge("west", true)); await page.waitForTimeout(180); }
  await page.waitForFunction(() => window.__SPACE_LAB_TEST__!.getLoadedChunks().includes("chunk_1_0")); const exportedAfter = await page.evaluate(() => window.__SPACE_LAB_TEST__!.exportMap()); expect(exportedAfter.chunks.find((item: any) => item.id === "chunk_1_0")?.objects).toEqual(east.objects);
  const final = await page.evaluate(() => window.__SPACE_LAB_TEST__!.getVisualState()); expect(final.fps).toBeGreaterThan(10); monitor.assertClean(); console.log(`[VISUAL] PASS fps=${final.fps.toFixed(1)} meshes=${final.meshes} materials=${final.materials} lights=${final.activeLights}`);
});

test("Visual System mobile AUTO budget", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 }); const page = await context.newPage(); const monitor = monitorErrors(page); await openLab(page); await startGame(page, "EXPLORATION");
  await page.evaluate(() => window.__SPACE_LAB_TEST__!.setVisualQuality("AUTO")); await page.waitForTimeout(1200); const state = await page.evaluate(() => window.__SPACE_LAB_TEST__!.getVisualState()); expect(state.resolvedQuality).toBe("LOW"); expect(state.shadow).toBeFalsy(); expect(state.fps).toBeGreaterThan(5); await screenshot(page, "visual/mobile-auto.png"); monitor.assertClean(); console.log(`[VISUAL MOBILE] PASS fps=${state.fps.toFixed(1)} meshes=${state.meshes} materials=${state.materials} lights=${state.activeLights}`); await context.close();
});
