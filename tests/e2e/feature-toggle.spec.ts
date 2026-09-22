import { expect, test } from "@playwright/test";

test("Feature profiles, overrides and disabled runtime", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error" && !message.text().includes("NAVIGATION FALLBACK")) errors.push(message.text()); });
  await page.goto("/feature-toggle-test.html");
  await page.waitForFunction(() => typeof (window as any).runFeatureToggleTest === "function");
  const result = await page.evaluate(() => (window as any).runFeatureToggleTest());
  expect(result.full).toEqual(expect.arrayContaining(["worldMap", "map", "chunkStreaming", "missions", "inventory", "npc", "enemies", "missionGuide"]));
  expect(result.minimal).toEqual(expect.arrayContaining(["worldMap", "map", "chunkStreaming", "interaction"]));
  expect(result.minimal).not.toEqual(expect.arrayContaining(["missions", "enemies", "navigation"]));
  expect(result.exploration).toEqual(expect.arrayContaining(["worldMap", "chunkStreaming", "interiors", "navigation", "interaction"]));
  expect(result.customDisabled).toEqual(expect.arrayContaining(["missions", "enemies", "npc", "inventory", "navigation", "chunkStreaming"]));
  expect(result.dependencyChunk).toBe(false);
  expect(result.dependencyReason).toContain("requires worldMap");
  expect(result.runtime.lifecycle).toBe("RUNNING");
  expect(result.runtime.navigation).toBe(false);
  expect(result.runtime.map).toBe(true);
  expect(result.runtime.interaction).toBe(true);
  expect(result.runtime.mapState.autoExpansion).toBe(false);
  expect(result.runtime.mapState.chunkUnload).toBe(false);
  expect(errors).toEqual([]);
});
