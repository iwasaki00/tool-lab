import { expect, test } from "@playwright/test";

test("Framework Public API", async ({ page }) => {
  await page.goto("/framework-api-test.html");
  await page.waitForFunction(() => typeof (window as unknown as { runFrameworkApiSmoke?: unknown }).runFrameworkApiSmoke === "function");
  const result = await page.evaluate(async () => {
    const apiWindow = window as unknown as { runFrameworkApiSmoke: () => Promise<Record<string, unknown>> };
    return apiWindow.runFrameworkApiSmoke();
  });

  expect(result.exportedFrameworkVersion).toBe("1.2.1");
  expect(result.stateFrameworkVersion).toBe("1.2.1");
  expect(result.exportedMapFormatVersion).toBe(1);
  expect(result.stateMapFormatVersion).toBe(1);
  expect(result.lifecycle).toBe("RUNNING");
  expect(result.disposedLifecycle).toBe("DISPOSED");
  expect(result.worldAreaCount).toBeGreaterThan(0);
  expect(result.mapAvailable).toBe(true);
  expect(result.navigationAvailable).toBe(true);
  expect(result.interactionAvailable).toBe(true);
  expect(result.playerAvailable).toBe(true);
  expect(result.visualAvailable).toBe(true);
  expect(result.eventReceived).toBe(true);
  expect(result.mapSeed).toBe(13579);
  expect(result.features).toEqual(["navigation", "map", "interaction"]);
});
