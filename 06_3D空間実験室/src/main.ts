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
import { loadMovementSettings, saveMovementSettings, type MovementSettings } from "./player/movementSettings";
import { GameSession, type GameSessionSnapshot } from "./game/GameSession";
import { decodeChallengeCode, encodeChallengeCode, type GameConfig, type GameMode } from "./game/GameTypes";
import { resolveGameMode } from "./game/GameModeManager";
import type { GameplayCallbacks } from "./gameplay/createDemoScenario";

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
let movementSettings: MovementSettings = loadMovementSettings();
let enemyAIEnabled = true;
let missionTestMode = false;
let gameConfig: GameConfig = { mode: "ESCAPE", difficulty: citySettings.missionDifficulty, citySeed: citySettings.seed, missionSeed: citySettings.missionSeed, testMode: false };
let gameSession: GameSession | undefined;
let detectionLatched = false;
let discoveryNoticeTimer = 0;

const gameCallbacks: GameplayCallbacks = {
  ...gameplayUi.callbacks,
  onMissionComplete: (result) => { gameplayUi.callbacks.onMissionComplete(result); if (gameConfig.mode !== "EXPLORATION") gameSession?.complete(); },
  onPlayerCaught: (id) => {
    if (id.endsWith(":detected")) { const notice = document.querySelector<HTMLElement>("#discovery-notice"); if (notice) { notice.textContent = "DETECTED"; notice.classList.add("is-visible"); window.clearTimeout(discoveryNoticeTimer); discoveryNoticeTimer = window.setTimeout(() => notice.classList.remove("is-visible"), 1400); } }
    if (!id.endsWith(":detected")) gameSession?.caught();
  },
  onDiscovery: (snapshot) => {
    gameSession?.updateDiscovery(snapshot);
    const notice = document.querySelector<HTMLElement>("#discovery-notice");
    if (notice && snapshot.lastLabel) { notice.textContent = `NEW DISCOVERY — ${snapshot.lastLabel}`; notice.classList.add("is-visible"); window.clearTimeout(discoveryNoticeTimer); discoveryNoticeTimer = window.setTimeout(() => notice.classList.remove("is-visible"), 1800); }
  },
};

try {
  if (!Engine.IsSupported) throw new Error("このブラウザではWebGLを利用できません。");

  // Babylon EngineはWebGL2を優先し、利用できない端末ではWebGLへ自動フォールバックする。
  engine = new Engine(canvas, true, { stencil: true, preserveDrawingBuffer: false }, false);
  engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio || 1, 2));
  laboratory = createLaboratoryScene(engine, canvas, mobile, { worldMode: currentWorld, citySettings, gameplayCallbacks: gameCallbacks, gameMode: gameConfig.mode });
  laboratory.player.setMovementSpeeds(movementSettings);
  laboratory.setMissionGuideMode(currentGuideMode);
  gameplayUi.setInteractHandler(() => getLaboratory().interact());
  hideInitializationError();
  if (mobile) detachMobileControls = attachMobileControls(laboratory.player);
  laboratory.setPaused(true);

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
    movementSpeed: (settings) => {
      movementSettings = settings;
      saveMovementSettings(settings);
      getLaboratory().player.setMovementSpeeds(settings);
    },
    restartMission: (settings) => {
      citySettings = settings; saveCitySettings(settings);
      getLaboratory().restartMission(settings); refresh(`Mission Seed ${settings.missionSeed} でMissionを再開しました`);
    },
    regenerateMission: (settings) => {
      const next = { ...settings, missionSeed: Math.floor(Math.random() * 4294967294) + 1 };
      citySettings = next; saveCitySettings(next);
      const input = document.querySelector<HTMLInputElement>("#mission-seed-input"); if (input) input.value = String(next.missionSeed);
      getLaboratory().restartMission(next); refresh(`新しいMission Seed ${next.missionSeed} で生成しました`);
    },
    enemyAI: (enabled) => { enemyAIEnabled = enabled; getLaboratory().setEnemyAI(enabled && !missionTestMode); refresh(`ENEMY AI ${enabled ? "ON" : "OFF"}`); },
    missionTestMode: (enabled) => { missionTestMode = enabled; getLaboratory().setEnemyAI(enemyAIEnabled && !enabled); refresh(`MISSION TEST ${enabled ? "ON — Enemy停止" : "OFF"}`); },
    navigationTest: (enabled) => { getLaboratory().setNavigationTest(enabled); refresh(`NAV TEST ${enabled ? "ON — 地面を選択してください" : "OFF"}`); },
  }, citySettings, movementSettings);

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
    laboratory = createLaboratoryScene(getEngine(), canvas!, mobile, { worldMode: mode, citySettings: settings, gameplayCallbacks: gameCallbacks, gameMode: gameConfig.mode });
    laboratory.player.setMovementSpeeds(movementSettings);
    laboratory.setMissionGuideMode(currentGuideMode);
    laboratory.setEnemyAI(enemyAIEnabled && !missionTestMode);
    gameplayUi.setInteractHandler(() => getLaboratory().interact());
    laboratory.setDayMode(currentTime === "day");
    hideInitializationError();
    if (mobile) detachMobileControls = attachMobileControls(laboratory.player);
    debugMode = false;
    controls.setWorldMode(mode);
    updateGuideMode(mode);
    refresh(message);
  }

  const gameTitle = document.querySelector<HTMLElement>("#game-title-screen");
  const gameLoading = document.querySelector<HTMLElement>("#game-loading-screen");
  const pauseScreen = document.querySelector<HTMLElement>("#pause-screen");
  const tutorialScreen = document.querySelector<HTMLElement>("#tutorial-screen");
  const resultScreen = document.querySelector<HTMLElement>("#result-screen");
  let selectedMode: GameMode = "ESCAPE";

  document.querySelectorAll<HTMLButtonElement>("[data-game-mode]").forEach((button) => button.addEventListener("click", () => {
    selectedMode = button.dataset.gameMode as GameMode;
    document.querySelectorAll("[data-game-mode]").forEach((item) => item.classList.toggle("is-selected", item === button));
    updateBestPreview();
  }));
  document.querySelector("#game-difficulty")?.addEventListener("change", updateBestPreview);
  document.querySelector("#start-game-button")?.addEventListener("click", () => void startConfiguredGame(false));
  document.querySelector("#load-challenge")?.addEventListener("click", () => {
    const parsed = decodeChallengeCode(document.querySelector<HTMLInputElement>("#challenge-code")?.value ?? "");
    if (!parsed) { controls.showToast("Challenge Codeが正しくありません"); return; }
    selectedMode = parsed.mode; setInput("game-difficulty", parsed.difficulty); setInput("game-city-seed", String(parsed.citySeed)); setInput("game-mission-seed", String(parsed.missionSeed));
    document.querySelectorAll<HTMLElement>("[data-game-mode]").forEach((item) => item.classList.toggle("is-selected", item.dataset.gameMode === selectedMode)); updateBestPreview();
  });
  document.querySelector("#resume-game")?.addEventListener("click", resumeGame);
  document.querySelector("#pause-game-button")?.addEventListener("click", pauseGame);
  document.querySelector("#pause-restart")?.addEventListener("click", () => void startConfiguredGame(true));
  document.querySelector("#result-restart")?.addEventListener("click", () => void startConfiguredGame(true));
  document.querySelector("#result-new")?.addEventListener("click", () => { setInput("game-city-seed", String(randomSeed())); setInput("game-mission-seed", String(randomSeed())); void startConfiguredGame(false); });
  document.querySelector("#pause-title")?.addEventListener("click", showTitle);
  document.querySelector("#result-title")?.addEventListener("click", showTitle);
  document.querySelector("#change-game-mode")?.addEventListener("click", showTitle);
  document.querySelector("#game-test-button")?.addEventListener("click", () => {
    gameConfig.testMode = !gameConfig.testMode; const button = document.querySelector<HTMLButtonElement>("#game-test-button"); if (button) button.textContent = `GAME TEST ${gameConfig.testMode ? "ON" : "OFF"}`;
    applyGameRules(); controls.showToast(gameConfig.testMode ? "GAME TEST: 敵停止 / DEBUG GUIDE" : "GAME TEST OFF");
  });
  document.querySelector("#tutorial-close")?.addEventListener("click", () => { tutorialScreen?.classList.remove("is-visible"); resumeGame(); });
  document.addEventListener("keydown", (event) => {
    const target = event.target as HTMLElement | null; if (target?.matches("input,textarea,select")) return;
    if (event.code === "Escape" && gameSession?.snapshot().state === "PLAYING") pauseGame();
  });

  async function startConfiguredGame(sameSeeds: boolean): Promise<void> {
    if (!sameSeeds) {
      gameConfig = {
        mode: selectedMode,
        difficulty: (document.querySelector<HTMLSelectElement>("#game-difficulty")?.value ?? "NORMAL") as GameConfig["difficulty"],
        citySeed: normalizedSeed("game-city-seed"), missionSeed: normalizedSeed("game-mission-seed"),
        testMode: Boolean(document.querySelector<HTMLInputElement>("#title-test-mode")?.checked),
      };
    }
    selectedMode = gameConfig.mode; detectionLatched = false; currentWorld = "city";
    const rules = resolveGameMode(gameConfig);
    citySettings = { ...citySettings, seed: gameConfig.citySeed, missionSeed: gameConfig.missionSeed, missionDifficulty: gameConfig.difficulty, missionType: rules.missionType };
    saveCitySettings(citySettings); gameSession = new GameSession(gameConfig, renderGameSession); gameSession.setState("GENERATING");
    hideGameScreens(); gameLoading?.classList.add("is-visible"); setText("game-loading-title", "GENERATING WORLD..."); setText("game-loading-stage", "WORLD 1 / 4");
    document.body.className = `${mobile ? "is-mobile" : "is-desktop"} game-mode-${gameConfig.mode.toLowerCase()} game-state-generating`;
    await nextPaint();
    try {
      rebuildWorld("city", citySettings, `${gameConfig.mode} / ${gameConfig.difficulty}`); getLaboratory().setPaused(true);
      setText("game-loading-title", "GENERATING NAVIGATION..."); setText("game-loading-stage", "NAVIGATION 2 / 4"); await waitForNavigation();
      setText("game-loading-title", "CREATING MISSION..."); setText("game-loading-stage", "MISSION 3 / 4"); await nextPaint();
      if (!getLaboratory().missionDebug().validation.valid) throw new Error("Mission validation failed");
      setText("game-loading-title", "SPAWNING CHARACTERS..."); setText("game-loading-stage", "CHARACTERS 4 / 4"); applyGameRules(); await nextPaint();
      gameSession.setState("READY");
      setText("game-loading-title", "READY"); for (const label of ["3", "2", "1", "START"]) { setText("game-countdown", label); await delay(label === "START" ? 450 : 650); }
      gameLoading?.classList.remove("is-visible"); setText("game-countdown", ""); gameSession.start(); getLaboratory().setPaused(false); applyGameRules(); maybeShowTutorial();
    } catch (error) {
      console.error("GAME GENERATION FAILED", error); gameSession.fail(error instanceof Error ? error.message : String(error));
    }
  }

  function applyGameRules(): void {
    const rules = resolveGameMode(gameConfig); currentGuideMode = gameConfig.testMode ? "DEBUG_ALL" : rules.guide;
    getLaboratory().setMissionGuideMode(currentGuideMode); getLaboratory().setEnemyAI(rules.enemies && !gameConfig.testMode && enemyAIEnabled && !missionTestMode);
    getLaboratory().setDebugMode(gameConfig.testMode || debugMode);
    setText("game-mode-hud", gameConfig.mode); if (gameConfig.mode === "EXPLORATION") setText("objective-text", rules.objective);
  }

  function pauseGame(): void { if (gameSession?.snapshot().state !== "PLAYING") return; gameSession.pause(); getLaboratory().setPaused(true); pauseScreen?.classList.add("is-visible"); if (document.pointerLockElement) document.exitPointerLock(); }
  function resumeGame(): void { if (gameSession?.snapshot().state !== "PAUSED") return; pauseScreen?.classList.remove("is-visible"); gameSession.resume(); getLaboratory().setPaused(false); }
  function showTitle(): void { getLaboratory().setPaused(true); gameSession?.setState("TITLE"); hideGameScreens(); gameTitle?.classList.add("is-visible"); updateBestPreview(); }
  function hideGameScreens(): void { [gameTitle, gameLoading, pauseScreen, tutorialScreen, resultScreen].forEach((screen) => screen?.classList.remove("is-visible")); }
  function maybeShowTutorial(): void {
    const key = `3d-space-lab-tutorial-${gameConfig.mode}`; if (localStorage.getItem(key)) return;
    localStorage.setItem(key, "1"); gameSession?.pause(); getLaboratory().setPaused(true); setText("tutorial-title", gameConfig.mode);
    setText("tutorial-text", gameConfig.mode === "ESCAPE" ? "案内を追い、鍵やカードキーを集めてGoalへ到達してください。" : gameConfig.mode === "STEALTH" ? "敵の視界を避けてMissionを達成してください。Detectionが最大になると発見されます。" : "街の公園・広場・建物を巡り、5か所とランドマークを発見してください。"); tutorialScreen?.classList.add("is-visible");
  }
  function renderGameSession(snapshot: GameSessionSnapshot): void {
    document.body.classList.forEach((name) => { if (name.startsWith("game-state-")) document.body.classList.remove(name); }); document.body.classList.add(`game-state-${snapshot.state.toLowerCase()}`);
    setText("game-timer", formatGameTime(snapshot.elapsedSeconds)); setText("discovery-value", `${snapshot.discovery.discovered} / ${snapshot.discovery.target} ・ BUILDINGS ${snapshot.discovery.buildingsVisited} / ${snapshot.discovery.buildingTarget}`); setText("discovery-landmark", snapshot.discovery.landmarkFound ? "LANDMARK 発見済み" : "LANDMARK 未発見");
    const detection = document.querySelector<HTMLElement>("#detection-meter"); const discovery = document.querySelector<HTMLElement>("#discovery-progress"); detection!.hidden = gameConfig.mode !== "STEALTH"; discovery!.hidden = gameConfig.mode !== "EXPLORATION";
    if (snapshot.result) renderResult(snapshot.result);
  }
  function renderResult(result: NonNullable<GameSessionSnapshot["result"]>): void {
    try { getLaboratory().setPaused(true); } catch (error) { console.warn("Could not pause scene while displaying result", error); }
    if (document.pointerLockElement) document.exitPointerLock(); hideGameScreens(); resultScreen?.classList.add("is-visible");
    setText("result-status", result.status === "COMPLETE" ? "GAME COMPLETE" : result.reason?.toLowerCase().includes("generation") || result.reason?.toLowerCase().includes("navigation") ? "GAME GENERATION ERROR" : "GAME FAILED"); setText("result-score", `${result.score.toLocaleString()} PTS`);
    let missionProgress = "—"; try { const mission = getLaboratory().missionDebug().state; missionProgress = `${mission.completed}/${mission.total}`; } catch { /* A failed generation may not have a live MissionRuntime. */ }
    const challenge = encodeChallengeCode(gameConfig); const details = document.querySelector<HTMLElement>("#result-details"); if (details) details.innerHTML = `<p>${result.mode} / ${result.difficulty}</p><p>TIME ${formatGameTime(result.clearTimeSeconds)} ・ MISSION ${missionProgress}</p><p>DETECTIONS ${result.detections} ・ CAUGHT ${result.caughtCount} ・ DISCOVERY ${result.discovered}</p><p>CITY SEED ${result.citySeed} ・ MISSION SEED ${result.missionSeed}</p><p>CODE ${challenge}</p>${result.reason ? `<p>${result.reason}</p>` : ""}`;
    const restartButton = document.querySelector<HTMLButtonElement>("#result-restart"); if (restartButton) restartButton.textContent = result.status === "FAILED" ? "RETRY" : "RESTART";
    const best = gameSession?.best(); setText("result-best", best ? `BEST ${best.score.toLocaleString()} PTS / ${formatGameTime(best.clearTimeSeconds)}` : "");
  }
  function updateBestPreview(): void {
    const difficulty = (document.querySelector<HTMLSelectElement>("#game-difficulty")?.value ?? "NORMAL") as GameConfig["difficulty"];
    const store = new GameSession({ ...gameConfig, mode: selectedMode, difficulty }, () => undefined); const preview = store.best(); setText("title-best-score", preview ? `BEST ${preview.score.toLocaleString()} PTS / ${formatGameTime(preview.clearTimeSeconds)}` : "BEST SCORE —");
    const list = document.querySelector<HTMLOListElement>("#play-history-list"); if (list) list.replaceChildren(...store.history().slice(0, 5).map((entry) => { const row = document.createElement("li"); row.textContent = `${entry.mode} ${entry.difficulty} / ${entry.score} PTS / ${formatGameTime(entry.clearTimeSeconds)} / ${entry.citySeed}`; return row; }));
  }
  async function waitForNavigation(): Promise<void> { const start = performance.now(); while (getLaboratory().navigationDebug().status === "BUILDING") { if (performance.now() - start > 20000) throw new Error("Navigation generation timed out"); await delay(100); } if (getLaboratory().navigationDebug().status === "ERROR") throw new Error("Navigation generation failed"); }
  function normalizedSeed(id: string): number { const value = Math.floor(Number(document.querySelector<HTMLInputElement>(`#${id}`)?.value)); return Number.isFinite(value) && value > 0 ? Math.min(4294967295, value) : randomSeed(); }
  function randomSeed(): number { return Math.floor(Math.random() * 4294967294) + 1; }
  function setInput(id: string, value: string): void { const input = document.querySelector<HTMLInputElement | HTMLSelectElement>(`#${id}`); if (input) input.value = value; }
  function nextPaint(): Promise<void> { return new Promise((resolve) => requestAnimationFrame(() => resolve())); }
  function delay(ms: number): Promise<void> { return new Promise((resolve) => window.setTimeout(resolve, ms)); }
  setInput("game-city-seed", String(citySettings.seed)); setInput("game-mission-seed", String(citySettings.missionSeed)); updateBestPreview();

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
      gameSession?.tick();
      const detectionValue = getLaboratory().characterDebug().detection;
      setText("detection-value", `${Math.round(detectionValue * 100)}%`);
      const detectionFill = document.querySelector<HTMLElement>("#detection-fill"); if (detectionFill) detectionFill.style.width = `${Math.round(detectionValue * 100)}%`;
      if (detectionValue >= .99 && !detectionLatched) { detectionLatched = true; if (gameConfig.mode === "STEALTH") gameSession?.addDetection(); }
      if (detectionValue < .35) detectionLatched = false;
      const game = gameSession?.snapshot(); if (game) { setText("game-debug-mode", gameConfig.mode); setText("game-debug-state", game.state); setText("game-debug-difficulty", gameConfig.difficulty); setText("game-debug-timer", formatGameTime(game.elapsedSeconds)); setText("game-debug-score", String(game.result?.score ?? 0)); setText("game-debug-discovery", `${game.discovery.discovered}/${game.discovery.target} ・ BLD ${game.discovery.buildingsVisited}/${game.discovery.buildingTarget}`); }
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

function formatGameTime(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(whole / 60)).padStart(2, "0")}:${String(whole % 60).padStart(2, "0")}`;
}

function setText(id: string, value: string): void {
  const element = document.getElementById(id); if (element) element.textContent = value;
}
