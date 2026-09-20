import { expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

export const FIXED_SEEDS = { citySeed: 123456, missionSeed: 654321 };

export interface ErrorMonitor { assertClean: () => void; errors: string[] }

export function monitorErrors(page: Page): ErrorMonitor {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text(); const source = message.location().url;
    if (/NAVIGATION FALLBACK|favicon|WebGL.*performance caveat/i.test(text) || (/404/.test(text) && /favicon|apple-touch-icon|\.well-known\/appspecific\/com\.chrome\.devtools\.json/i.test(source))) return;
    errors.push(`console.error: ${text}${source ? ` (${source})` : ""}`);
  });
  return { errors, assertClean: () => expect(errors, errors.join("\n")).toEqual([]) };
}

export async function openLab(page: Page, demo = false): Promise<void> {
  await page.goto(`/06_3D%E7%A9%BA%E9%96%93%E5%AE%9F%E9%A8%93%E5%AE%A4/?${demo ? "demo" : "e2e"}=1`);
  await page.waitForFunction(() => Boolean((window as Window & { __SPACE_LAB_TEST__?: unknown }).__SPACE_LAB_TEST__));
  await expect(page.locator("#render-canvas")).toBeVisible();
}

export async function startGame(page: Page, mode: "ESCAPE" | "STEALTH" | "EXPLORATION", seeds = FIXED_SEEDS): Promise<void> {
  console.log(`[${mode}] Starting with city=${seeds.citySeed} mission=${seeds.missionSeed}`);
  await page.evaluate(async ({ gameMode, citySeed, missionSeed }) => {
    await window.__SPACE_LAB_TEST__!.startGame({ mode: gameMode, difficulty: "NORMAL", citySeed, missionSeed, testMode: true });
  }, { gameMode: mode, ...seeds });
  await page.waitForFunction(() => window.__SPACE_LAB_TEST__?.getGameState().session?.state === "PLAYING", undefined, { timeout: 60_000 });
  console.log(`[${mode}] World ready`);
}

export async function screenshot(page: Page, name: string): Promise<void> {
  const path = resolve("test-results", "screenshots", name); mkdirSync(dirname(path), { recursive: true });
  await page.screenshot({ path, fullPage: false });
}

export async function bridgeState<T>(page: Page, expression: string): Promise<T> {
  return page.evaluate((source) => {
    const bridge = window.__SPACE_LAB_TEST__!;
    return Function("bridge", `return (${source})`)(bridge) as T;
  }, expression);
}

export async function waitForMissionAdvance(page: Page, previousId?: string): Promise<void> {
  await page.waitForFunction((before) => {
    const mission = window.__SPACE_LAB_TEST__?.getMissionState();
    return Boolean(mission && (mission.complete || mission.current?.id !== before));
  }, previousId, { timeout: 12_000 });
}

export async function demoStep(page: Page, step: number, total: number, label: string, delay = 850): Promise<void> {
  await page.evaluate(({ stepNumber, count, text }) => window.__SPACE_LAB_TEST__?.setDemoStep(stepNumber, count, text), { stepNumber: step, count: total, text: label });
  await page.waitForTimeout(delay);
}

declare global {
  interface Window {
    __SPACE_LAB_TEST__?: {
      startGame(options: { mode: "ESCAPE" | "STEALTH" | "EXPLORATION"; difficulty?: "EASY" | "NORMAL" | "HARD"; citySeed?: number; missionSeed?: number; testMode?: boolean }): Promise<void>;
      getGameState(): any; getMissionState(): any; getMissionValidation(): any; getCurrentObjective(): any; getPlayerState(): any; getGuideState(): any; getWorldState(): any; getEnemyStates(): any; getDiscoveryState(): any;
      teleportToObjective(): void; teleportToStart(): void; teleportToGoal(): void; teleportTo(id: string): void; giveMissionItem(kind?: "KEY" | "CARD_KEY" | "BATTERY" | "ALL"): void; completeCurrentObjective(): void; completeMission(): void;
      setDoorState(id: string, state: "LOCKED" | "UNLOCKED" | "OPEN" | "CLOSED"): void; setSwitchState(id: string, state: "ON" | "OFF" | "TOGGLE"): void;
      setEnemyAI(enabled: boolean): void; enemyCommand(command: string): void; discover(command: "current" | "all" | "reset"): void;
      setDemoStep(step: number, total: number, label: string): void; clearDemoStep(): void;
      getMapState(): any; getCurrentChunk(): any; getLoadedChunks(): string[]; setAutoExpansion(enabled: boolean): void; setChunkUnload(enabled: boolean): void; teleportNearChunkEdge(direction?: "north" | "south" | "east" | "west", cross?: boolean): void; exportMap(): any; importMap(data: unknown): Promise<any>;
      getVisualState(): any; setEnvironmentPreset(preset: "CLEAR_DAY" | "CLOUDY" | "SUNSET" | "NIGHT" | "FOGGY"): void; setVisualQuality(quality: "AUTO" | "LOW" | "MEDIUM" | "HIGH"): void;
    };
  }
}
