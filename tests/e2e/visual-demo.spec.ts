import { test } from "@playwright/test";
import { demoStep, monitorErrors, openLab, screenshot, startGame } from "./helpers";

test("Visual Preset Demonstration", async ({ page }) => { const monitor = monitorErrors(page); await openLab(page, true); await startGame(page, "EXPLORATION"); const presets = ["CLEAR_DAY", "SUNSET", "NIGHT", "FOGGY"] as const; for (let index = 0; index < presets.length; index += 1) { const preset = presets[index]; await page.evaluate((value) => window.__SPACE_LAB_TEST__!.setEnvironmentPreset(value), preset); await demoStep(page, index + 1, presets.length, preset, 1400); await screenshot(page, `visual/demo-${preset.toLowerCase()}.png`); } await page.evaluate(() => window.__SPACE_LAB_TEST__!.clearDemoStep()); monitor.assertClean(); });
