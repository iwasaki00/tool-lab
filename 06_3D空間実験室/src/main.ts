import "@babylonjs/core/Collisions/collisionCoordinator";
import { Engine } from "@babylonjs/core/Engines/engine";
import "./style.css";
import { attachMobileControls } from "./player/mobileControls";
import { createLaboratoryScene, type LaboratoryApi } from "./scene/createScene";
import { createControls } from "./ui/createControls";
import { updateDebugReadout } from "./ui/debugReadout";
import { registerWebMcp } from "./ui/registerWebMcp";
import { createGameplayUi } from "./ui/gameplayUi";
import { loadCitySettings, saveCitySettings } from "./world/citySettingsStorage";
import { type CitySettings, type WorldMode } from "./world/types";
import type { MissionGuideMode } from "./gameplay/MissionGuideManager";

const mobile = matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
document.body.classList.add(mobile ? "is-mobile" : "is-desktop");
configureGuide(mobile);

const canvas = document.querySelector<HTMLCanvasElement>("#render-canvas");
if (!canvas) throw new Error("Rendering canvas was not found.");
const gameplayUi = createGameplayUi(mobile);

let engine: Engine | undefined;
let laboratory: LaboratoryApi | undefined;
let detachMobileControls: () => void = () => undefined;
let debugMode = false;
let currentWorld: WorldMode = "city";
let citySettings: CitySettings = loadCitySettings();
let currentTime: "day" | "night" = "day";
let currentGuideMode: MissionGuideMode = "DEBUG";

try {
  if (!Engine.IsSupported) throw new Error("このブラウザではWebGLを利用できません。");

  // Babylon EngineはWebGL2を優先し、利用できない端末ではWebGLへ自動フォールバックする。
  engine = new Engine(canvas, true, { stencil: true, preserveDrawingBuffer: false }, false);
  engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio || 1, 2));
  laboratory = createLaboratoryScene(engine, canvas, mobile, { worldMode: currentWorld, citySettings, gameplayCallbacks: gameplayUi.callbacks });
  laboratory.setMissionGuideMode(currentGuideMode);
  gameplayUi.setInteractHandler(() => getLaboratory().interact());
  hideInitializationError();
  if (mobile) detachMobileControls = attachMobileControls(laboratory.player);

  const controls = createControls({
    day: () => setTime("day"),
    night: () => setTime("night"),
    box: () => { getLaboratory().addBox(); refresh("箱を追加しました"); },
    sphere: () => { getLaboratory().addSphere(); refresh("球を追加しました"); },
    building: () => { getLaboratory().addBuilding(); refresh("建物を生成しました"); },
    random: () => { getLaboratory().randomize(); refresh("実験オブジェクトを再配置しました"); },
    debug: () => {
      debugMode = !debugMode;
      getLaboratory().setDebugMode(debugMode);
      controls.showToast(debugMode ? "描画テスト：赤いBoxを表示" : "描画テストを終了しました");
    },
    reset: () => {
      rebuildWorld(currentWorld, citySettings, "シーンを初期化しました");
    },
    selectWorld: (mode, settings) => {
      currentWorld = mode;
      if (mode === "city") citySettings = settings;
      rebuildWorld(mode, citySettings, mode === "city" ? "街生成モードへ切り替えました" : "実験フィールドへ切り替えました");
    },
    regenerateCity: (settings) => {
      currentWorld = "city";
      citySettings = settings;
      saveCitySettings(settings);
      controls.setWorldMode("city");
      rebuildWorld("city", settings, `Seed ${settings.seed} で街を生成しました`);
    },
    guideMode: (mode) => { currentGuideMode = mode; getLaboratory().setMissionGuideMode(mode); },
  }, citySettings);

  function refresh(message: string): void {
    controls.showToast(message);
    updateDebugReadout(getEngine(), getLaboratory(), mobile);
  }

  function setTime(mode: "day" | "night"): void {
    currentTime = mode;
    getLaboratory().setDayMode(mode === "day");
    controls.setMode(mode);
    controls.showToast(mode === "day" ? "昼モードに切り替えました" : "夜モードに切り替えました");
  }

  function rebuildWorld(mode: WorldMode, settings: CitySettings, message: string): void {
    detachMobileControls();
    getLaboratory().disposeWorld();
    getLaboratory().scene.dispose();
    laboratory = createLaboratoryScene(getEngine(), canvas!, mobile, { worldMode: mode, citySettings: settings, gameplayCallbacks: gameplayUi.callbacks });
    laboratory.setMissionGuideMode(currentGuideMode);
    gameplayUi.setInteractHandler(() => getLaboratory().interact());
    laboratory.setDayMode(currentTime === "day");
    hideInitializationError();
    if (mobile) detachMobileControls = attachMobileControls(laboratory.player);
    debugMode = false;
    controls.setWorldMode(mode);
    updateGuideMode(mode);
    refresh(message);
  }

  resizeEngine();
  controls.setWorldMode(currentWorld);
  controls.setMode(currentTime);
  updateGuideMode(currentWorld);
  let lastTelemetryUpdate = 0;
  engine.runRenderLoop(() => {
    getLaboratory().scene.render();
    const now = performance.now();
    if (now - lastTelemetryUpdate > 250) {
      const telemetry = getLaboratory().telemetry();
      controls.updateTelemetry(getEngine().getFps(), telemetry.worldMode, telemetry.seed, telemetry.style);
      updateDebugReadout(getEngine(), getLaboratory(), mobile);
      lastTelemetryUpdate = now;
    }
  });

  const resize = () => requestAnimationFrame(resizeEngine);
  window.addEventListener("resize", resize, { passive: true });
  window.addEventListener("orientationchange", resize, { passive: true });
  window.visualViewport?.addEventListener("resize", resize, { passive: true });

  if (!mobile) {
    canvas.addEventListener("click", () => {
      if (document.pointerLockElement !== canvas) void canvas.requestPointerLock();
    });
    document.addEventListener("pointerlockchange", () => {
      document.querySelector("#start-guide")?.classList.toggle("is-hidden", document.pointerLockElement === canvas);
    });
  } else {
    document.querySelector("#start-guide")?.addEventListener("pointerdown", () => {
      document.querySelector("#start-guide")?.classList.add("is-hidden");
    });
  }

  document.addEventListener("gesturestart", (event) => event.preventDefault(), { passive: false });
  registerWebMcp({
    addObject: (type) => {
      if (type === "box") getLaboratory().addBox();
      else if (type === "sphere") getLaboratory().addSphere();
      else getLaboratory().addBuilding();
      refresh(`${type} を追加しました`);
    },
    setTime,
    randomize: () => { getLaboratory().randomize(); refresh("実験オブジェクトを再配置しました"); },
    generateCity: (settings) => {
      currentWorld = "city";
      citySettings = settings;
      saveCitySettings(settings);
      controls.setWorldMode("city");
      rebuildWorld("city", settings, `Seed ${settings.seed} で街を生成しました`);
    },
    getStatus: () => ({ objectCount: getLaboratory().objectCount(), city: getLaboratory().cityStats(), ...getLaboratory().telemetry() }),
  });
} catch (error) {
  showInitializationError(error);
}

window.addEventListener("error", (event) => showInitializationError(event.error ?? event.message));
window.addEventListener("unhandledrejection", (event) => showInitializationError(event.reason));

function resizeEngine(): void {
  if (!engine) return;
  engine.resize();
  requestAnimationFrame(() => {
    engine?.resize();
    if (laboratory && engine) updateDebugReadout(engine, laboratory, mobile);
  });
}

function getEngine(): Engine {
  if (!engine) throw new Error("3D Engine is not initialized.");
  return engine;
}

function getLaboratory(): LaboratoryApi {
  if (!laboratory) throw new Error("3D Scene is not initialized.");
  return laboratory;
}

function configureGuide(isMobile: boolean): void {
  if (!isMobile) return;
  const title = document.querySelector("#guide-title");
  const description = document.querySelector("#guide-description");
  if (title) title.textContent = "タップして探索を開始";
  if (description) description.textContent = "左スティックで移動・右画面をドラッグして見回す";
  document.querySelector("#desktop-guide")?.remove();
}

function updateGuideMode(mode: WorldMode): void {
  const label = document.querySelector("#guide-kicker");
  if (label) label.textContent = mode === "city" ? "CITY READY" : "FIELD READY";
}

function showInitializationError(error: unknown): void {
  console.error("3D INITIALIZE ERROR", error);
  const panel = document.querySelector<HTMLElement>("#error-panel");
  const message = document.querySelector<HTMLElement>("#error-message");
  if (message) message.textContent = error instanceof Error ? error.message : String(error);
  if (panel) panel.hidden = false;
}

function hideInitializationError(): void {
  const panel = document.querySelector<HTMLElement>("#error-panel");
  if (panel) panel.hidden = true;
}
