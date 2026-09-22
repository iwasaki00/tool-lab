import { expect, test } from "@playwright/test";
import { monitorErrors, openLab, startGame } from "./helpers";

test("Release Candidate fresh start and storage compatibility", async ({ browser }) => {
  const freshContext = await browser.newContext();
  const freshPage = await freshContext.newPage();
  const freshMonitor = monitorErrors(freshPage);
  await openLab(freshPage);
  await startGame(freshPage, "ESCAPE");
  expect((await freshPage.evaluate(() => window.__SPACE_LAB_TEST__!.getGameState())).session?.state).toBe("PLAYING");
  const exportedMap = await freshPage.evaluate(() => window.__SPACE_LAB_TEST__!.exportMap());
  freshMonitor.assertClean();
  await freshContext.close();

  const importContext = await browser.newContext();
  const importPage = await importContext.newPage();
  const importMonitor = monitorErrors(importPage);
  await openLab(importPage);
  await startGame(importPage, "ESCAPE");
  await importPage.evaluate(async (map) => { await window.__SPACE_LAB_TEST__!.importMap(map); }, exportedMap);
  const importedMap = await importPage.evaluate(() => window.__SPACE_LAB_TEST__!.exportMap());
  expect(importedMap.seed).toBe(exportedMap.seed);
  expect(importedMap.chunks.map((chunk: any) => `${chunk.id}:${chunk.seed}`).sort()).toEqual(exportedMap.chunks.map((chunk: any) => `${chunk.id}:${chunk.seed}`).sort());
  importMonitor.assertClean();
  await importContext.close();

  const storedContext = await browser.newContext();
  await storedContext.addInitScript(() => {
    localStorage.setItem("3d-space-lab-city-settings-v3", "{broken-json");
    localStorage.setItem("3d-space-lab-movement-settings", JSON.stringify({ normalSpeed: "invalid", shiftSpeed: 999 }));
    localStorage.setItem("3d-space-lab-best-scores", "not-json");
  });
  const storedPage = await storedContext.newPage();
  const storedMonitor = monitorErrors(storedPage);
  await openLab(storedPage);
  await startGame(storedPage, "EXPLORATION");
  expect((await storedPage.evaluate(() => window.__SPACE_LAB_TEST__!.getGameState())).session?.state).toBe("PLAYING");
  storedMonitor.assertClean();
  await storedContext.close();
});

test("Release Candidate restart and resource stability", async ({ page }) => {
  test.setTimeout(120_000);
  const monitor = monitorErrors(page);
  await openLab(page);
  await startGame(page, "ESCAPE");
  const baseline = await snapshot(page);
  for (let index = 0; index < 5; index += 1) {
    await startGame(page, "ESCAPE");
    const current = await snapshot(page);
    expect(current.enemies).toBe(baseline.enemies);
    expect(current.npcs).toBe(baseline.npcs);
    expect(current.steps).toBe(baseline.steps);
    expect(current.meshes).toBeLessThanOrEqual(baseline.meshes + 3);
    expect(current.materials).toBeLessThanOrEqual(baseline.materials + 3);
    expect(current.lights).toBe(baseline.lights);
    expect(current.objectiveCards).toBe(baseline.objectiveCards);
  }
  const exported = await page.evaluate(() => window.__SPACE_LAB_TEST__!.exportMap());
  await page.evaluate(async (map) => { await window.__SPACE_LAB_TEST__!.importMap(map); }, exported);
  await waitForNavigationIdle(page);
  const firstReload = await snapshot(page);
  const firstResources = await page.evaluate(() => window.__SPACE_LAB_TEST__!.getResourceState());
  await page.evaluate(async (map) => { await window.__SPACE_LAB_TEST__!.importMap(map); }, exported);
  await waitForNavigationIdle(page);
  const secondReload = await snapshot(page);
  const secondResources = await page.evaluate(() => window.__SPACE_LAB_TEST__!.getResourceState());
  const stableMesh = (names: string[]) => names.filter((name) => !/navigation-path|waypoint-debug/.test(name));
  const stableMaterial = (names: string[]) => names.filter((name) => name !== "colorShader");
  expect(stableMesh(secondResources.meshNames)).toEqual(stableMesh(firstResources.meshNames));
  expect(secondReload.meshes).toBeLessThanOrEqual(firstReload.meshes + 6);
  expect(stableMaterial(secondResources.materialNames)).toEqual(stableMaterial(firstResources.materialNames));
  expect(secondResources.materialNames.filter((name) => name === "colorShader").length).toBeLessThanOrEqual(secondResources.lineMeshes);
  expect(secondReload.lights).toBe(firstReload.lights);
  expect(secondResources.beforeRenderObservers).toBe(firstResources.beforeRenderObservers);
  expect(secondResources.pointerObservers).toBe(firstResources.pointerObservers);
  monitor.assertClean();
});

test("Release Candidate navigation fallback and soak", async ({ page }) => {
  test.setTimeout(120_000);
  const monitor = monitorErrors(page);
  await openLab(page);
  await startGame(page, "ESCAPE");
  await page.evaluate(() => { window.__SPACE_LAB_TEST__!.setAutoExpansion(true); window.__SPACE_LAB_TEST__!.setChunkUnload(true); });
  const directions = ["east", "south", "west", "north"] as const;
  for (let index = 0; index < 32; index += 1) {
    const direction = directions[index % directions.length];
    await page.evaluate((value) => window.__SPACE_LAB_TEST__!.teleportNearChunkEdge(value), direction);
    await page.waitForTimeout(100);
    await page.evaluate((value) => window.__SPACE_LAB_TEST__!.teleportNearChunkEdge(value, true), direction);
    await page.waitForTimeout(120);
    if (index % 8 === 7) await page.evaluate(() => window.__SPACE_LAB_TEST__!.completeCurrentObjective());
  }
  const map = await page.evaluate(() => window.__SPACE_LAB_TEST__!.getMapState());
  const game = await page.evaluate(() => window.__SPACE_LAB_TEST__!.getGameState());
  expect(map.totalChunks).toBeGreaterThan(1);
  expect(map.loadedChunks.length).toBeLessThanOrEqual(map.totalChunks);
  expect(["PLAYING", "COMPLETE"]).toContain(game.session?.state);
  expect(["READY", "FALLBACK"]).toContain(game.navigation.status);
  monitor.assertClean();
});

async function snapshot(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const bridge = window.__SPACE_LAB_TEST__!;
    const visual = bridge.getVisualState();
    const characters = bridge.getEnemyStates();
    const mission = bridge.getMissionState();
    return {
      meshes: visual.meshes,
      materials: visual.materials,
      lights: visual.activeLights,
      enemies: characters.enemyCount,
      npcs: characters.npcCount,
      steps: mission.plan.steps.length,
      objectiveCards: document.querySelectorAll("#objective-panel").length,
    };
  });
}

async function waitForNavigationIdle(page: import("@playwright/test").Page) {
  await page.waitForFunction(() => window.__SPACE_LAB_TEST__!.getGameState().navigation.status !== "BUILDING");
  await page.waitForTimeout(650);
  await page.waitForFunction(() => window.__SPACE_LAB_TEST__!.getGameState().navigation.status !== "BUILDING");
}
