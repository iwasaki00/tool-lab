import { bindStandardMobileControls, createFramework, type FrameworkApi } from "../../src/framework/index";
import { walkAppConfig } from "./appConfig";

const canvas = required<HTMLCanvasElement>("#walk-canvas");
const mobile = matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
const framework = await createFramework({ ...walkAppConfig, canvas, mobile });
await framework.initialize();
await framework.start();

document.documentElement.dataset.walkReady = "true";
document.body.classList.toggle("is-mobile", mobile);
const player = framework.getPlayer();
const map = framework.getMap();
let interactionCount = 0;

document.querySelectorAll<HTMLButtonElement>("[data-environment]").forEach((button) => button.addEventListener("click", () => {
  framework.getVisual().setEnvironment(button.dataset.environment as "CLEAR_DAY" | "SUNSET" | "NIGHT");
  document.querySelectorAll("[data-environment]").forEach((item) => item.classList.toggle("is-active", item === button));
}));

required<HTMLButtonElement>("#auto-expansion").addEventListener("click", (event) => {
  const button = event.currentTarget as HTMLButtonElement;
  const enabled = button.dataset.enabled !== "true";
  map?.setAutoExpansion(enabled);
  button.dataset.enabled = String(enabled);
  button.textContent = `AUTO EXPANSION ${enabled ? "ON" : "OFF"}`;
});

const interact = () => {
  framework.getInteraction()?.interact();
  interactionCount += 1;
  required("#interaction-state").textContent = `INTERACTION ${interactionCount}`;
};
required("#interact-button").addEventListener("click", interact);
window.addEventListener("keydown", (event) => { if (event.code === "KeyE") interact(); });
canvas.addEventListener("click", () => { if (!mobile && document.pointerLockElement !== canvas) void canvas.requestPointerLock(); });

let releaseMobile: () => void = () => undefined;
if (mobile) {
  releaseMobile = bindStandardMobileControls(player, {
    joystick: required<HTMLElement>("#joystick"), knob: required<HTMLElement>("#joystick-knob"), lookZone: required<HTMLElement>("#look-zone"),
    jumpButton: required<HTMLElement>("#jump-button"), interactionButton: required<HTMLElement>("#mobile-interact-button"),
  }, interact);
}

const refresh = () => {
  const state = map?.snapshot();
  required("#chunk-state").textContent = state ? `CHUNK ${state.currentChunk.x}, ${state.currentChunk.z} · ${state.totalChunks}` : "CHUNK DISABLED";
  required("#profile-state").textContent = `${framework.getFeatures().profile} PROFILE`;
};
refresh();
const telemetry = window.setInterval(refresh, 250);
window.addEventListener("beforeunload", () => { window.clearInterval(telemetry); releaseMobile(); framework.dispose(); }, { once: true });

declare global {
  interface Window { __WALK_SAMPLE__?: { framework: FrameworkApi; interactionCount: () => number; moveNearEastBoundary: () => void } }
}
window.__WALK_SAMPLE__ = {
  framework,
  interactionCount: () => interactionCount,
  moveNearEastBoundary: () => {
    const state = map?.snapshot();
    if (!state) return;
    const position = player.getPosition();
    position.x = state.currentChunk.x * state.chunkSize + state.chunkSize / 2 - Math.max(2, state.triggerDistance - 2);
    player.setPosition(position);
  },
};

function required<T extends Element = HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`3D WALK UI NOT FOUND: ${selector}`);
  return element;
}
