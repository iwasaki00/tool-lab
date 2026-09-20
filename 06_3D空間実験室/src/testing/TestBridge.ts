import type { GameConfig, GameMode } from "../game/GameTypes";
import type { GameSessionSnapshot } from "../game/GameSession";
import type { MissionDifficulty, MissionRuntimeSnapshot } from "../gameplay/MissionTypes";
import type { LaboratoryApi } from "../scene/createScene";
import type { EnvironmentPreset, VisualQuality } from "../visual/VisualConfig";

export interface TestStartOptions {
  mode: GameMode;
  difficulty?: MissionDifficulty;
  citySeed?: number;
  missionSeed?: number;
  testMode?: boolean;
}

export interface SpaceLabTestBridge {
  ready: boolean;
  startGame: (options: TestStartOptions) => Promise<void>;
  getGameState: () => { session?: GameSessionSnapshot; config: GameConfig; navigation: ReturnType<LaboratoryApi["navigationDebug"]>; canvas: { width: number; height: number; clientWidth: number; clientHeight: number }; sceneReady: boolean; playerReady: boolean; generationError: boolean };
  getMissionState: () => MissionRuntimeSnapshot;
  getMissionValidation: () => ReturnType<LaboratoryApi["missionDebug"]>["validation"];
  getCurrentObjective: () => MissionRuntimeSnapshot["current"];
  getPlayerState: () => ReturnType<LaboratoryApi["debugTest"]>["player"];
  getGuideState: () => ReturnType<LaboratoryApi["missionGuideDebug"]>;
  getWorldState: () => ReturnType<LaboratoryApi["debugTest"]>;
  getEnemyStates: () => ReturnType<LaboratoryApi["characterDebug"]>;
  getDiscoveryState: () => ReturnType<LaboratoryApi["discovery"]>;
  getMapState: () => ReturnType<LaboratoryApi["mapState"]>;
  getCurrentChunk: () => ReturnType<LaboratoryApi["mapState"]>["currentChunk"];
  getLoadedChunks: () => string[];
  setAutoExpansion: (enabled: boolean) => void;
  setChunkUnload: (enabled: boolean) => void;
  teleportNearChunkEdge: (direction?: "north" | "south" | "east" | "west", cross?: boolean) => void;
  exportMap: () => ReturnType<LaboratoryApi["saveMap"]>;
  importMap: (data: unknown) => Promise<ReturnType<LaboratoryApi["saveMap"]>>;
  getVisualState: () => ReturnType<LaboratoryApi["visualState"]> & { fps: number };
  setEnvironmentPreset: (preset: EnvironmentPreset) => void;
  setVisualQuality: (quality: VisualQuality) => void;
  teleportToObjective: () => void;
  teleportToStart: () => void;
  teleportToGoal: () => void;
  teleportTo: (id: string) => void;
  giveMissionItem: (kind?: "KEY" | "CARD_KEY" | "BATTERY" | "ALL") => void;
  completeCurrentObjective: () => void;
  completeMission: () => void;
  setDoorState: (id: string, state: "LOCKED" | "UNLOCKED" | "OPEN" | "CLOSED") => void;
  setSwitchState: (id: string, state: "ON" | "OFF" | "TOGGLE") => void;
  setEnemyAI: (enabled: boolean) => void;
  enemyCommand: (command: Parameters<LaboratoryApi["debugEnemy"]>[0]) => void;
  discover: (command: "current" | "all" | "reset") => void;
  setDemoStep: (step: number, total: number, label: string) => void;
  clearDemoStep: () => void;
}

declare global { interface Window { __SPACE_LAB_TEST__?: SpaceLabTestBridge } }

export function installTestBridge(options: {
  laboratory: () => LaboratoryApi;
  canvas: HTMLCanvasElement;
  config: () => GameConfig;
  session: () => GameSessionSnapshot | undefined;
  startGame: (options: TestStartOptions) => Promise<void>;
}): void {
  const query = new URLSearchParams(location.search);
  if (!import.meta.env.DEV || (!query.has("e2e") && !query.has("demo"))) return;
  const lab = () => options.laboratory();
  const bridge: SpaceLabTestBridge = {
    ready: true,
    startGame: options.startGame,
    getGameState: () => ({ session: options.session(), config: options.config(), navigation: lab().navigationDebug(), canvas: { width: options.canvas.width, height: options.canvas.height, clientWidth: options.canvas.clientWidth, clientHeight: options.canvas.clientHeight }, sceneReady: Boolean(lab().scene.activeCamera && !lab().scene.isDisposed), playerReady: Boolean(lab().player.camera), generationError: Boolean(document.querySelector("#generation-error-screen.is-visible")) }),
    getMissionState: () => lab().missionDebug().state,
    getMissionValidation: () => lab().missionDebug().validation,
    getCurrentObjective: () => lab().missionDebug().state.current,
    getPlayerState: () => lab().debugTest().player,
    getGuideState: () => lab().missionGuideDebug(),
    getWorldState: () => lab().debugTest(),
    getEnemyStates: () => lab().characterDebug(),
    getDiscoveryState: () => lab().discovery(),
    getMapState: () => lab().mapState(),
    getCurrentChunk: () => lab().mapState().currentChunk,
    getLoadedChunks: () => lab().mapState().loadedChunks,
    setAutoExpansion: (enabled) => lab().setAutoExpansion(enabled),
    setChunkUnload: (enabled) => lab().setChunkUnload(enabled),
    teleportNearChunkEdge: (direction = "east", cross = false) => lab().teleportNearChunkEdge(direction, cross),
    exportMap: () => lab().saveMap(),
    importMap: (data) => lab().loadMap(data),
    getVisualState: () => ({ ...lab().visualState(), fps: lab().scene.getEngine().getFps() }),
    setEnvironmentPreset: (preset) => lab().setEnvironmentPreset(preset),
    setVisualQuality: (quality) => lab().setVisualQuality(quality),
    teleportToObjective: () => lab().debugCommand("teleport-current"),
    teleportToStart: () => lab().debugCommand("teleport-start"),
    teleportToGoal: () => lab().debugCommand("teleport-goal"),
    teleportTo: (id) => lab().debugCommand("teleport-room", id),
    giveMissionItem: (kind = "ALL") => lab().debugCommand(kind === "KEY" ? "give-key" : kind === "CARD_KEY" ? "give-card" : kind === "BATTERY" ? "give-battery" : "give-all"),
    completeCurrentObjective: () => lab().debugCommand("complete-current"),
    completeMission: () => { for (let index = 0; index < 20 && !lab().missionDebug().state.complete; index += 1) lab().debugCommand("complete-current"); },
    setDoorState: (id, state) => lab().debugCommand(state === "OPEN" ? "door-open" : state === "CLOSED" ? "door-close" : state === "LOCKED" ? "door-lock" : "door-unlock", id),
    setSwitchState: (id, state) => lab().debugCommand(state === "ON" ? "switch-on" : state === "OFF" ? "switch-off" : "switch-toggle", id),
    setEnemyAI: (enabled) => lab().setEnemyAI(enabled),
    enemyCommand: (command) => lab().debugEnemy(command),
    discover: (command) => lab().debugDiscovery(command),
    setDemoStep: (step, total, label) => showDemoStep(step, total, label),
    clearDemoStep: () => document.querySelector("#e2e-demo-status")?.remove(),
  };
  window.__SPACE_LAB_TEST__ = bridge;
  document.documentElement.dataset.testBridge = "ready";
  console.info("[E2E] SPACE LAB TEST BRIDGE READY");
}

function showDemoStep(step: number, total: number, label: string): void {
  let element = document.querySelector<HTMLElement>("#e2e-demo-status");
  if (!element) { element = document.createElement("aside"); element.id = "e2e-demo-status"; document.body.append(element); }
  element.textContent = `DEMO  •  STEP ${step} / ${total}  •  ${label}`;
}
