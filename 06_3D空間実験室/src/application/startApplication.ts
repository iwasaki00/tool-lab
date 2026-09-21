import { Engine } from "@babylonjs/core/Engines/engine";
import { attachMobileControls } from "../player/mobileControls";
import { createLaboratoryScene, type LaboratoryApi } from "../scene/createScene";
import { createControls } from "../ui/createControls";
import { updateDebugReadout } from "../ui/debugReadout";
import { registerWebMcp } from "../ui/registerWebMcp";
import { createGameplayUi } from "../ui/gameplayUi";
import { loadCitySettings, saveCitySettings } from "../world/citySettingsStorage";
import { type CitySettings, type WorldMode } from "../world/types";
import type { MissionGuideMode } from "../gameplay/MissionGuideManager";
import { loadMovementSettings, saveMovementSettings, type MovementSettings } from "../player/movementSettings";
import { GameSession, type GameSessionSnapshot } from "../game/GameSession";
import { decodeChallengeCode, encodeChallengeCode, type GameConfig, type GameMode } from "../game/GameTypes";
import { resolveGameMode } from "../game/GameModeManager";
import { getGameMode } from "../game/GameModeRegistry";
import { applyGameUiPolicy } from "../game/GameUiAdapter";
import type { GameplayCallbacks } from "../contracts/ScenarioContracts";
import { createDebugPanel } from "../debug/DebugPanel";
import { installTestBridge, type TestStartOptions } from "../testing/TestBridge";
import { FRAMEWORK_VERSION, MAP_FORMAT_VERSION, logFrameworkVersion } from "../core/version";
import type { WorldMapData } from "../map/WorldMapData";
import type { EnvironmentPreset, VisualQuality } from "../visual/VisualConfig";
import { renderMapStatus, renderNavigationStatus } from "../ui/frameworkStatusUi";
import { createDemoScenario } from "../game/sample/createDemoScenario";

export function startApplication(): void {

const mobile = matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
logFrameworkVersion();
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
let gameConfig: GameConfig = { mode: "ESCAPE", difficulty: citySettings.missionDifficulty, citySeed: citySettings.seed, missionSeed: citySettings.missionSeed, testMode: false, autoExpansion: true, chunkUnload: true };
let gameSession: GameSession | undefined;
let detectionLatched = false;
let discoveryNoticeTimer = 0;
let autoExpansion = true;
let chunkUnload = true;
let environmentPreset: EnvironmentPreset = "CLEAR_DAY";
let visualQuality: VisualQuality = mobile ? "AUTO" : "AUTO";

const gameCallbacks: GameplayCallbacks = {
  ...gameplayUi.callbacks,
  onMissionComplete: (result) => { gameplayUi.callbacks.onMissionComplete(result); if (getGameMode(gameConfig.mode).completeOnMission) gameSession?.complete(); },
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
  // Mobile Safari/Chrome can report DPR 3–4. Rendering at that full backing resolution
  // multiplies fill cost without improving playability on a small screen.
  engine.setHardwareScalingLevel(mobile ? 1 : 1 / Math.min(window.devicePixelRatio || 1, 2));
  laboratory = createLaboratoryScene(engine, canvas, mobile, { worldMode: currentWorld, citySettings, gameplayCallbacks: gameCallbacks, scenarioFactory: createDemoScenario, scenarioPolicy: getGameMode(gameConfig.mode).scenario(gameConfig, mobile), onMapStatus: renderMapStatus, onNavigationStatus: renderNavigationStatus });
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
      document.body.classList.toggle("debug-enabled", debugMode);
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
  installMapControls();
  installVisualControls();

  const debugPanel = createDebugPanel({
    laboratory: getLaboratory,
    completeGame: () => {
      if (getGameMode(gameConfig.mode).debugCompletion === "DISCOVERY") getLaboratory().debugDiscovery("all");
      else for (let index = 0; index < 20 && !getLaboratory().missionDebug().state.complete; index += 1) getLaboratory().debugCommand("complete-current");
    },
    failGame: () => gameSession?.fail("[DEBUG] Forced game failure"),
    pauseTimer: (paused) => gameSession?.debugPauseTimer(paused),
    adjustTime: (seconds) => gameSession?.debugAdjustTime(seconds),
    adjustScore: (points) => gameSession?.debugAdjustScore(points),
    resetScore: () => gameSession?.debugResetScore(),
    resetTestState,
    restartGame: () => void startConfiguredGame(true),
    setSpeedMultiplier: (multiplier) => getLaboratory().player.setMovementSpeeds({ normalSpeed: movementSettings.normalSpeed * multiplier, shiftSpeed: movementSettings.shiftSpeed * multiplier }),
    guideMode: (mode) => { currentGuideMode = mode; getLaboratory().setMissionGuideMode(mode); },
    setSimulationSpeed: (scale) => getLaboratory().setSimulationSpeed(scale),
    setSimulationPaused: (paused) => { getLaboratory().setSimulationPaused(paused); gameSession?.debugPauseTimer(paused); },
    snapshotHeader: () => { const state = gameSession?.snapshot(); return [`MODE=${gameConfig.mode}`, `DIFFICULTY=${gameConfig.difficulty}`, `STATE=${state?.state ?? "TITLE"}`, `CITY_SEED=${gameConfig.citySeed}`, `MISSION_SEED=${gameConfig.missionSeed}`, `TIMER=${formatGameTime(state?.elapsedSeconds ?? 0)}`, `SCORE=${state?.result?.score ?? gameSession?.debugScore() ?? 0}`]; },
    panelOpenChanged: (open) => getLaboratory().player.setInputEnabled(!open && gameSession?.snapshot().state === "PLAYING"),
  });

  function refresh(message: string): void {
    controls.showToast(message);
    updateDebugReadout(getEngine(), getLaboratory(), mobile);
  }

  function setTime(mode: "day" | "night"): void {
    currentTime = mode;
    environmentPreset = mode === "day" ? "CLEAR_DAY" : "NIGHT";
    getLaboratory().setDayMode(mode === "day");
    controls.setMode(mode);
    controls.showToast(mode === "day" ? "昼モードに切り替えました" : "夜モードに切り替えました");
  }

  function resetTestState(): void {
    getLaboratory().restartMission(citySettings); getLaboratory().player.setMovementSpeeds(movementSettings); applyGameRules();
    gameSession = new GameSession(gameConfig, renderGameSession); gameSession.start(); getLaboratory().setPaused(false); controls.showToast("[DEBUG] TEST STATE RESET");
  }

  function rebuildWorld(mode: WorldMode, settings: CitySettings, message: string): void {
    detachMobileControls();
    getLaboratory().disposeWorld();
    getLaboratory().scene.dispose();
    laboratory = createLaboratoryScene(getEngine(), canvas!, mobile, { worldMode: mode, citySettings: settings, gameplayCallbacks: gameCallbacks, scenarioFactory: createDemoScenario, scenarioPolicy: getGameMode(gameConfig.mode).scenario(gameConfig, mobile), onMapStatus: renderMapStatus, onNavigationStatus: renderNavigationStatus });
    laboratory.player.setMovementSpeeds(movementSettings);
    laboratory.setMissionGuideMode(currentGuideMode);
    laboratory.setEnemyAI(enemyAIEnabled && !missionTestMode);
    laboratory.setAutoExpansion(autoExpansion);
    laboratory.setChunkUnload(chunkUnload);
    laboratory.setEnvironmentPreset(environmentPreset);
    laboratory.setVisualQuality(visualQuality);
    gameplayUi.setInteractHandler(() => getLaboratory().interact());
    laboratory.setDayMode(currentTime === "day");
    hideInitializationError();
    if (mobile) detachMobileControls = attachMobileControls(laboratory.player);
    debugMode = false;
    document.body.classList.remove("debug-enabled");
    controls.setWorldMode(mode);
    updateGuideMode(mode);
    refresh(message);
  }

  const gameTitle = document.querySelector<HTMLElement>("#game-title-screen");
  const gameLoading = document.querySelector<HTMLElement>("#game-loading-screen");
  const pauseScreen = document.querySelector<HTMLElement>("#pause-screen");
  const tutorialScreen = document.querySelector<HTMLElement>("#tutorial-screen");
  const resultScreen = document.querySelector<HTMLElement>("#result-screen");
  const generationErrorScreen = document.querySelector<HTMLElement>("#generation-error-screen");
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
  document.querySelector("#generation-retry")?.addEventListener("click", () => void startConfiguredGame(true));
  document.querySelector("#generation-title")?.addEventListener("click", showTitle);
  document.querySelector("#change-game-mode")?.addEventListener("click", showTitle);
  document.querySelector("#game-test-button")?.addEventListener("click", () => {
    gameConfig.testMode = !gameConfig.testMode; const button = document.querySelector<HTMLButtonElement>("#game-test-button"); if (button) button.textContent = `GAME TEST ${gameConfig.testMode ? "ON" : "OFF"}`;
    document.body.classList.toggle("game-test-enabled", gameConfig.testMode);
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
        autoExpansion,
        chunkUnload,
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
      console.error("GAME GENERATION FAILED", error); showGenerationError(error);
    }
  }

  function applyGameRules(): void {
    const policy = getGameMode(gameConfig.mode); const rules = policy.configure(gameConfig); currentGuideMode = gameConfig.testMode ? "DEBUG_ALL" : rules.guide;
    autoExpansion = gameConfig.autoExpansion ?? autoExpansion;
    chunkUnload = gameConfig.chunkUnload ?? chunkUnload;
    getLaboratory().setAutoExpansion(autoExpansion);
    getLaboratory().setChunkUnload(chunkUnload);
    document.body.classList.toggle("game-test-enabled", gameConfig.testMode);
    getLaboratory().setMissionGuideMode(currentGuideMode); getLaboratory().setEnemyAI(rules.enemies && !gameConfig.testMode && enemyAIEnabled && !missionTestMode);
    getLaboratory().setDebugMode(gameConfig.testMode || debugMode);
    setText("game-mode-hud", gameConfig.mode); if (policy.ui.showDiscovery) setText("objective-text", rules.objective);
  }

  function pauseGame(): void { if (gameSession?.snapshot().state !== "PLAYING") return; gameSession.pause(); getLaboratory().setPaused(true); pauseScreen?.classList.add("is-visible"); if (document.pointerLockElement) document.exitPointerLock(); }
  function resumeGame(): void { if (gameSession?.snapshot().state !== "PAUSED") return; pauseScreen?.classList.remove("is-visible"); gameSession.resume(); getLaboratory().setPaused(false); }
  function showTitle(): void { getLaboratory().setPaused(true); gameSession?.setState("TITLE"); hideGameScreens(); gameTitle?.classList.add("is-visible"); updateBestPreview(); }
  function hideGameScreens(): void { [gameTitle, gameLoading, pauseScreen, tutorialScreen, resultScreen, generationErrorScreen].forEach((screen) => screen?.classList.remove("is-visible")); }
  function showGenerationError(error: unknown): void {
    gameSession?.setState("FAILED"); try { getLaboratory().setPaused(true); } catch { /* The scene may not exist after a world generation failure. */ }
    hideGameScreens(); setText("generation-error-message", error instanceof Error ? error.message : String(error)); generationErrorScreen?.classList.add("is-visible");
  }
  function maybeShowTutorial(): void {
    const policy = getGameMode(gameConfig.mode);
    const key = `3d-space-lab-tutorial-${gameConfig.mode}`; if (localStorage.getItem(key)) return;
    localStorage.setItem(key, "1"); gameSession?.pause(); getLaboratory().setPaused(true);
    applyGameUiPolicy(policy, { tutorialTitle: document.querySelector<HTMLElement>("#tutorial-title"), tutorialText: document.querySelector<HTMLElement>("#tutorial-text") }); tutorialScreen?.classList.add("is-visible");
  }
  function renderGameSession(snapshot: GameSessionSnapshot): void {
    document.body.classList.forEach((name) => { if (name.startsWith("game-state-")) document.body.classList.remove(name); }); document.body.classList.add(`game-state-${snapshot.state.toLowerCase()}`);
    setText("game-timer", formatGameTime(snapshot.elapsedSeconds)); setText("discovery-value", `${snapshot.discovery.discovered} / ${snapshot.discovery.target} ・ BUILDINGS ${snapshot.discovery.buildingsVisited} / ${snapshot.discovery.buildingTarget}`); setText("discovery-landmark", snapshot.discovery.landmarkFound ? "LANDMARK 発見済み" : "LANDMARK 未発見");
    const policy = getGameMode(gameConfig.mode); applyGameUiPolicy(policy, { detection: document.querySelector<HTMLElement>("#detection-meter"), discovery: document.querySelector<HTMLElement>("#discovery-progress") });
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
  async function waitForNavigation(): Promise<void> {
    const start = performance.now();
    while (getLaboratory().navigationDebug().status === "BUILDING") {
      if (performance.now() - start > 7000) { getLaboratory().useNavigationFallback("NavMesh build timed out after 7 seconds"); break; }
      await delay(100);
    }
    const navigation = getLaboratory().navigationDebug();
    if (navigation.status === "ERROR") getLaboratory().useNavigationFallback(navigation.error || "NavMesh build failed");
    const resolved = getLaboratory().navigationDebug();
    if (resolved.status === "FALLBACK") {
      console.warn("GAME CONTINUES WITH NAVIGATION FALLBACK", { citySeed: gameConfig.citySeed, gameMode: gameConfig.mode, difficulty: gameConfig.difficulty, ...resolved });
      controls.showToast(`NAVIGATION FALLBACK — ${resolved.mode}`);
    }
  }
  function normalizedSeed(id: string): number { const value = Math.floor(Number(document.querySelector<HTMLInputElement>(`#${id}`)?.value)); return Number.isFinite(value) && value > 0 ? Math.min(4294967295, value) : randomSeed(); }
  function randomSeed(): number { return Math.floor(Math.random() * 4294967294) + 1; }
  function setInput(id: string, value: string): void { const input = document.querySelector<HTMLInputElement | HTMLSelectElement>(`#${id}`); if (input) input.value = value; }
  function nextPaint(): Promise<void> { return new Promise((resolve) => requestAnimationFrame(() => resolve())); }
  function delay(ms: number): Promise<void> { return new Promise((resolve) => window.setTimeout(resolve, ms)); }
  function installMapControls(): void {
    const expansionButton = document.querySelector<HTMLButtonElement>("#auto-expansion-toggle"); const unloadButton = document.querySelector<HTMLButtonElement>("#chunk-unload-toggle"); const fileInput = document.querySelector<HTMLInputElement>("#map-file-input");
    const syncButtons = () => { if (expansionButton) { expansionButton.textContent = `AUTO EXPANSION ${autoExpansion ? "ON" : "OFF"}`; expansionButton.classList.toggle("is-active", autoExpansion); } if (unloadButton) { unloadButton.textContent = `CHUNK UNLOAD ${chunkUnload ? "ON" : "OFF"}`; unloadButton.classList.toggle("is-active", chunkUnload); } };
    expansionButton?.addEventListener("click", () => { autoExpansion = !autoExpansion; getLaboratory().setAutoExpansion(autoExpansion); syncButtons(); controls.showToast(`AUTO WORLD EXPANSION ${autoExpansion ? "ON" : "OFF"}`); });
    unloadButton?.addEventListener("click", () => { chunkUnload = !chunkUnload; getLaboratory().setChunkUnload(chunkUnload); syncButtons(); controls.showToast(`CHUNK UNLOAD ${chunkUnload ? "ON" : "OFF"}`); });
    document.querySelector("#export-map-button")?.addEventListener("click", () => { const map = getLaboratory().saveMap(); downloadMap(map); controls.showToast(`MAP EXPORTED — ${map.chunks.length} CHUNKS`); });
    document.querySelector("#import-map-button")?.addEventListener("click", () => fileInput?.click());
    document.querySelector("#save-map-button")?.addEventListener("click", () => { const name = document.querySelector<HTMLInputElement>("#map-name-input")?.value; const map = getLaboratory().saveMapToBrowser(name); renderMapBrowser(); controls.showToast(`MAP SAVED — ${map.mapName}`); });
    fileInput?.addEventListener("change", async () => { const file = fileInput.files?.[0]; if (!file) return; try { await applyImportedMap(JSON.parse(await file.text()) as unknown); controls.showToast("MAP IMPORTED"); } catch (error) { console.error("MAP IMPORT ERROR", error); controls.showToast(error instanceof Error ? error.message : "MAP IMPORT ERROR"); } finally { fileInput.value = ""; } });
    document.querySelector("#map-browser-list")?.addEventListener("click", async (event) => { const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-map-id]"); if (!button) return; const id = button.dataset.mapId!; if (button.dataset.mapAction === "delete") { getLaboratory().deleteMapFromBrowser(id); renderMapBrowser(); return; } try { await applyImportedMap(getLaboratory().loadMapFromBrowser(id)); controls.showToast(`MAP LOADED — ${id}`); } catch (error) { console.error("MAP LOAD ERROR", error); controls.showToast(error instanceof Error ? error.message : "MAP LOAD ERROR"); } });
    syncButtons(); renderMapBrowser();
  }
  function installVisualControls(): void {
    const environment = document.querySelector<HTMLSelectElement>("#environment-preset-select"); const quality = document.querySelector<HTMLSelectElement>("#visual-quality-select");
    if (environment) { environment.value = environmentPreset; environment.addEventListener("change", () => { environmentPreset = environment.value as EnvironmentPreset; currentTime = environmentPreset === "NIGHT" ? "night" : "day"; getLaboratory().setEnvironmentPreset(environmentPreset); controls.setMode(currentTime); controls.showToast(`ENVIRONMENT ${environmentPreset}`); }); }
    if (quality) { quality.value = visualQuality; quality.addEventListener("change", () => { visualQuality = quality.value as VisualQuality; getLaboratory().setVisualQuality(visualQuality); controls.showToast(`VISUAL QUALITY ${visualQuality}`); }); }
    const debugToggles: Array<[string, "LIGHTS" | "LOD" | "CHUNK_LOD"]> = [["show-lights-toggle", "LIGHTS"], ["show-lod-toggle", "LOD"], ["show-chunk-lod-toggle", "CHUNK_LOD"]];
    debugToggles.forEach(([id, kind]) => { const button = document.querySelector<HTMLButtonElement>(`#${id}`); let enabled = false; button?.addEventListener("click", () => { enabled = !enabled; getLaboratory().setVisualDebug(kind, enabled); button.textContent = `SHOW ${kind.replace("_", " ")} ${enabled ? "ON" : "OFF"}`; button.classList.toggle("is-active", enabled); }); });
  }
  async function applyImportedMap(value: unknown): Promise<void> {
    const candidate = value as Partial<WorldMapData>; if (!Number.isFinite(candidate.seed)) throw new Error("INVALID MAP DATA");
    currentWorld = "city"; citySettings = { ...citySettings, seed: Number(candidate.seed) }; saveCitySettings(citySettings); rebuildWorld("city", citySettings, "保存Mapを読み込みました"); const map = await getLaboratory().loadMap(value); autoExpansion = map.metadata.autoExpansion; chunkUnload = map.metadata.chunkUnload; renderMapBrowser();
  }
  function downloadMap(map: WorldMapData): void { const blob = new Blob([JSON.stringify(map, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${map.mapId}.json`; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 0); }
  function renderMapBrowser(): void { const container = document.querySelector<HTMLElement>("#map-browser-list"); if (!container || !laboratory) return; const maps = getLaboratory().listBrowserMaps(); if (!maps.length) { container.innerHTML = "<small>保存Mapなし</small>"; return; } container.replaceChildren(...maps.map((map) => { const row = document.createElement("div"); row.className = "map-browser-entry"; const label = document.createElement("span"); label.textContent = `${map.mapName}\n${map.mapId} / v${map.mapFormatVersion} / SEED ${map.seed} / ${map.chunkCount} chunks`; const load = document.createElement("button"); load.textContent = "LOAD"; load.dataset.mapAction = "load"; load.dataset.mapId = map.mapId; const remove = document.createElement("button"); remove.textContent = "DELETE"; remove.dataset.mapAction = "delete"; remove.dataset.mapId = map.mapId; row.append(label, load, remove); return row; })); }
  async function startTestGame(options: TestStartOptions): Promise<void> {
    selectedMode = options.mode;
    document.querySelectorAll<HTMLElement>("[data-game-mode]").forEach((item) => item.classList.toggle("is-selected", item.dataset.gameMode === selectedMode));
    setInput("game-difficulty", options.difficulty ?? "NORMAL"); setInput("game-city-seed", String(options.citySeed ?? 123456)); setInput("game-mission-seed", String(options.missionSeed ?? 654321));
    const testMode = document.querySelector<HTMLInputElement>("#title-test-mode"); if (testMode) testMode.checked = options.testMode ?? true;
    await startConfiguredGame(false);
    if (gameSession?.snapshot().state === "PAUSED" && tutorialScreen?.classList.contains("is-visible")) { tutorialScreen.classList.remove("is-visible"); resumeGame(); }
  }
  installTestBridge({ laboratory: getLaboratory, canvas, config: () => ({ ...gameConfig }), session: () => gameSession?.snapshot(), startGame: startTestGame });
  console.info(`[3D SPACE LAB] Ready — Framework ${FRAMEWORK_VERSION}, Map Format ${MAP_FORMAT_VERSION}`);
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
      if (debugPanel.isOpen()) updateDebugReadout(getEngine(), getLaboratory(), mobile);
      gameSession?.tick();
      const detectionValue = getLaboratory().characterDebug().detection;
      setText("detection-value", `${Math.round(detectionValue * 100)}%`);
      const detectionFill = document.querySelector<HTMLElement>("#detection-fill"); if (detectionFill) detectionFill.style.width = `${Math.round(detectionValue * 100)}%`;
      if (detectionValue >= .99 && !detectionLatched) { detectionLatched = true; if (getGameMode(gameConfig.mode).countDetections) gameSession?.addDetection(); }
      if (detectionValue < .35) detectionLatched = false;
      if (debugPanel.isOpen()) debugPanel.update();
      const game = gameSession?.snapshot(); if (game) { setText("game-debug-mode", gameConfig.mode); setText("game-debug-state", game.state); setText("game-debug-difficulty", gameConfig.difficulty); setText("game-debug-timer", formatGameTime(game.elapsedSeconds)); setText("game-debug-score", String(game.result?.score ?? gameSession?.debugScore() ?? 0)); setText("game-debug-discovery", `${game.discovery.discovered}/${game.discovery.target} ・ BLD ${game.discovery.buildingsVisited}/${game.discovery.buildingTarget}`); }
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
}
