import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { monitorErrors, openLab, screenshot, startGame } from "./helpers";

interface PerfSnapshot { fps: number; frameTimeMs: number; meshes: number; activeMeshes: number; materials: number; textures: number; activeLights: number; shadowCasters: number; drawCalls: number; loadedChunks: number; visibleBuildings: number; windowObjects: number; vegetation: number; streetLights: number; budgetStatus: string; materialDuplicateGroups: string[] }
const results: Record<string, PerfSnapshot> = {};

test.afterAll(() => { mkdirSync("test-results/performance", { recursive: true }); writeFileSync("test-results/performance/latest.json", JSON.stringify(results, null, 2)); });

test("Performance NORMAL and STRESS desktop", async ({ page }) => {
  test.setTimeout(180_000); const monitor = monitorErrors(page); await openLab(page); await startGame(page, "ESCAPE");
  results.normalDesktop = await measure(page); console.log(`[PERF NORMAL] ${JSON.stringify(results.normalDesktop)}`); expect(results.normalDesktop.fps).toBeGreaterThan(.5); await screenshot(page, "performance/normal-day.png"); await page.evaluate(() => window.__SPACE_LAB_TEST__!.setEnvironmentPreset("NIGHT")); await page.waitForTimeout(500); await screenshot(page, "performance/normal-night.png"); await page.evaluate(() => window.__SPACE_LAB_TEST__!.setEnvironmentPreset("CLEAR_DAY"));
  await page.evaluate(() => window.__SPACE_LAB_TEST__!.setChunkUnload(false)); for (let index = 0; index < 5; index += 1) { await page.evaluate(() => window.__SPACE_LAB_TEST__!.teleportNearChunkEdge("east")); await page.waitForTimeout(120); await page.evaluate(() => window.__SPACE_LAB_TEST__!.teleportNearChunkEdge("east", true)); await page.waitForTimeout(180); }
  results.stressDesktop = await measure(page); console.log(`[PERF STRESS] ${JSON.stringify(results.stressDesktop)}`); expect(results.stressDesktop.loadedChunks).toBeGreaterThanOrEqual(5); expect(results.stressDesktop.fps).toBeGreaterThan(.5); await page.evaluate(() => { window.__SPACE_LAB_TEST__!.teleportToStart(); window.__SPACE_LAB_TEST__!.setEnvironmentPreset("NIGHT"); }); await page.waitForTimeout(500); await screenshot(page, "performance/stress-night.png"); monitor.assertClean();
});

test("Performance MOBILE LOW", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 }); const page = await context.newPage(); const monitor = monitorErrors(page); await openLab(page); await startGame(page, "EXPLORATION"); await page.evaluate(() => window.__SPACE_LAB_TEST__!.setVisualQuality("LOW")); results.mobileLow = await measure(page); expect(results.mobileLow.activeLights).toBeLessThanOrEqual(6); expect(results.mobileLow.shadowCasters).toBeGreaterThanOrEqual(0); expect(results.mobileLow.fps).toBeGreaterThan(3); await screenshot(page, "performance/mobile-low.png"); monitor.assertClean(); console.log(`[PERF MOBILE] ${JSON.stringify(results.mobileLow)}`); await context.close();
});

async function measure(page: Page): Promise<PerfSnapshot> { await page.waitForTimeout(2500); const samples: PerfSnapshot[] = []; for (let index = 0; index < 7; index += 1) { samples.push(await page.evaluate(() => window.__SPACE_LAB_TEST__!.getPerformanceState())); await page.waitForTimeout(300); } samples.sort((a, b) => a.fps - b.fps); return samples[Math.floor(samples.length / 2)]; }
