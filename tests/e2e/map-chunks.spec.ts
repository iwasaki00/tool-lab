import { expect, test } from "@playwright/test";
import { monitorErrors, openLab, screenshot, startGame } from "./helpers";

test("World Map / Chunks", async ({ page }) => {
  const monitor = monitorErrors(page); await openLab(page); await startGame(page, "ESCAPE");
  const initial = await page.evaluate(() => window.__SPACE_LAB_TEST__!.getMapState()); expect(initial.mode).toBe("PROCEDURAL"); expect(initial.totalChunks).toBe(1);

  await page.evaluate(() => { window.__SPACE_LAB_TEST__!.setChunkUnload(false); window.__SPACE_LAB_TEST__!.setAutoExpansion(true); window.__SPACE_LAB_TEST__!.teleportNearChunkEdge("east"); });
  await page.waitForFunction(() => window.__SPACE_LAB_TEST__!.getMapState().totalChunks > 1); await screenshot(page, "chunks/01-generating-area.png");
  await page.evaluate(() => window.__SPACE_LAB_TEST__!.teleportNearChunkEdge("east", true)); await page.waitForFunction(() => window.__SPACE_LAB_TEST__!.getCurrentChunk().x === 1); expect((await page.evaluate(() => window.__SPACE_LAB_TEST__!.getLoadedChunks())).some((id) => id === "chunk_1_0")).toBeTruthy(); await screenshot(page, "chunks/02-new-chunk.png");

  await page.evaluate(() => { window.__SPACE_LAB_TEST__!.setAutoExpansion(false); window.__SPACE_LAB_TEST__!.teleportNearChunkEdge("east"); }); const beforeBoundary = await page.evaluate(() => window.__SPACE_LAB_TEST__!.getMapState());
  await page.evaluate(() => window.__SPACE_LAB_TEST__!.teleportNearChunkEdge("east", true)); await page.waitForTimeout(350); const blocked = await page.evaluate(() => window.__SPACE_LAB_TEST__!.getMapState()); expect(blocked.currentChunk.x).toBe(1); expect(blocked.totalChunks).toBe(beforeBoundary.totalChunks); await screenshot(page, "chunks/03-boundary.png");

  const exported = await page.evaluate(() => window.__SPACE_LAB_TEST__!.exportMap()); expect(exported.mapFormatVersion).toBe(1); expect(exported.frameworkVersion).toMatch(/^\d+\.\d+\.\d+$/); expect(exported.chunks.length).toBeGreaterThan(1);
  await page.evaluate(async (map) => { await window.__SPACE_LAB_TEST__!.importMap(map); }, exported); const restored = await page.evaluate(() => window.__SPACE_LAB_TEST__!.exportMap());
  expect((await page.evaluate(() => window.__SPACE_LAB_TEST__!.getMapState())).mode).toBe("PREBUILT");
  expect(restored.seed).toBe(exported.seed); expect(restored.chunks.map((item: any) => `${item.id}:${item.seed}`).sort()).toEqual(exported.chunks.map((item: any) => `${item.id}:${item.seed}`).sort());
  const futureVersionError = await page.evaluate(async (map) => { try { await window.__SPACE_LAB_TEST__!.importMap({ ...map, mapFormatVersion: 999 }); return ""; } catch (error) { return error instanceof Error ? error.message : String(error); } }, exported);
  expect(futureVersionError).toContain("UNSUPPORTED MAP VERSION");

  await page.evaluate(() => { window.__SPACE_LAB_TEST__!.setAutoExpansion(true); window.__SPACE_LAB_TEST__!.teleportNearChunkEdge("north"); }); const importedCount = restored.chunks.length;
  await page.waitForFunction((count) => window.__SPACE_LAB_TEST__!.getMapState().totalChunks > count, importedCount); expect((await page.evaluate(() => window.__SPACE_LAB_TEST__!.getMapState())).mode).toBe("HYBRID"); await screenshot(page, "chunks/04-hybrid-expansion.png");

  await page.evaluate(() => window.__SPACE_LAB_TEST__!.setChunkUnload(true));
  for (let index = 0; index < 5; index += 1) { await page.evaluate(() => window.__SPACE_LAB_TEST__!.teleportNearChunkEdge("east")); await page.waitForTimeout(120); await page.evaluate(() => window.__SPACE_LAB_TEST__!.teleportNearChunkEdge("east", true)); await page.waitForTimeout(220); }
  const streamed = await page.evaluate(() => window.__SPACE_LAB_TEST__!.getMapState()); expect(streamed.chunkUnload).toBeTruthy(); expect(streamed.loadedChunks.length).toBeLessThan(streamed.totalChunks);
  monitor.assertClean(); console.log("[WORLD MAP] Export / Import / Expansion / Boundary / Hybrid / Unload PASS");
});
