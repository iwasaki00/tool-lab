import type { Scene } from "@babylonjs/core/scene";
import type { CharacterManagerDebug } from "../characters/CharacterManager";
import type { FrameworkContext } from "../contracts/FrameworkContext";
import type { LaboratoryScenario } from "../contracts/ScenarioContracts";
import type { DebugCommand, DebugTestSnapshot } from "../debug/DebugTestManager";
import type { FrameworkApi } from "../framework";
import type { DiscoverySnapshot } from "../gameplay/DiscoveryManager";
import type { InventoryEntry } from "../gameplay/InventoryManager";
import type { MissionPlan } from "../gameplay/MissionGenerator";
import type { MissionGuideDebugInfo, MissionGuideMode } from "../gameplay/MissionGuideManager";
import type { MissionRuntimeSnapshot } from "../gameplay/MissionTypes";
import type { MissionValidation } from "../gameplay/MissionValidator";
import type { InteractionFocus } from "../interaction/Interactable";
import type { InteriorNavigation } from "../interior/Room";
import type { WorldMapManager } from "../map/WorldMapManager";
import type { MapStateSnapshot, WorldMapData } from "../map/WorldMapData";
import type { NavigationStats } from "../navigation/NavigationManager";
import type { PlayerController } from "../player/createPlayer";
import type { EnvironmentPreset, VisualQuality, VisualState } from "../visual/VisualConfig";
import type { MapArea2D, SemanticLocation, WorldStatistics } from "../world/SemanticTypes";
import type { CitySettings, CityStats, WorldMode } from "../world/types";

/**
 * @deprecated Compatibility façade for the original 3D Space Laboratory UI,
 * TestBridge, and WebMCP integration. New games and tools should use
 * FrameworkApi from `framework/index.ts`. This adapter may be removed in a
 * future Framework major version.
 */
export interface LaboratoryApi {
  readonly api: FrameworkApi;
  framework: FrameworkContext;
  scene: Scene;
  player: PlayerController;
  setDayMode: (isDay: boolean) => void;
  addBox: () => void;
  addSphere: () => void;
  addBuilding: () => void;
  randomize: () => void;
  setDebugMode: (enabled: boolean) => void;
  objectCount: () => number;
  telemetry: () => { x: number; y: number; z: number; mode: "day" | "night"; worldMode: WorldMode; seed?: number; style?: string };
  cityStats: () => CityStats | undefined;
  disposeWorld: () => void;
  interact: () => void;
  interactionDebug: () => InteractionFocus | undefined;
  inventory: () => InventoryEntry[];
  objective: () => string;
  interiorDebug: () => InteriorNavigation | undefined;
  semanticDebug: () => SemanticLocation;
  worldStatistics: () => WorldStatistics;
  missionDebug: () => { plan: MissionPlan; validation: MissionValidation; state: MissionRuntimeSnapshot };
  semanticMap: (floor?: number) => MapArea2D[];
  setMissionGuideMode: (mode: MissionGuideMode) => void;
  missionGuideDebug: () => MissionGuideDebugInfo;
  restartMission: (settings: CitySettings) => void;
  setEnemyAI: (enabled: boolean) => void;
  characterDebug: () => CharacterManagerDebug;
  navigationDebug: () => NavigationStats;
  useNavigationFallback: (reason: string) => void;
  retryNavigation: () => void;
  debugTest: () => DebugTestSnapshot;
  debugCommand: (command: DebugCommand, value?: string | number) => void;
  debugJumpTo: (stepId: string) => void;
  setDebugSelectMode: (enabled: boolean) => void;
  setNoClip: (enabled: boolean) => void;
  debugEnemy: (command: Parameters<LaboratoryScenario["debugEnemy"]>[0]) => void;
  debugDiscovery: (command: Parameters<LaboratoryScenario["debugDiscovery"]>[0]) => void;
  setSimulationPaused: (paused: boolean) => void;
  setSimulationSpeed: (scale: number) => void;
  setNavigationTest: (enabled: boolean) => void;
  setPaused: (paused: boolean) => void;
  discovery: () => DiscoverySnapshot;
  mapState: () => MapStateSnapshot;
  saveMap: () => WorldMapData;
  createProceduralMap: (seed?: number, style?: string) => WorldMapData;
  loadMap: (data: unknown) => Promise<WorldMapData>;
  saveMapToBrowser: (name?: string) => WorldMapData;
  listBrowserMaps: () => ReturnType<WorldMapManager["listBrowserMaps"]>;
  loadMapFromBrowser: (id: string) => WorldMapData;
  deleteMapFromBrowser: (id: string) => void;
  setAutoExpansion: (enabled: boolean) => void;
  setChunkUnload: (enabled: boolean) => void;
  teleportNearChunkEdge: (direction: "north" | "south" | "east" | "west", cross?: boolean) => void;
  visualState: () => VisualState;
  setEnvironmentPreset: (preset: EnvironmentPreset) => void;
  setVisualQuality: (quality: VisualQuality) => void;
  setVisualDebug: (kind: "LIGHTS" | "LOD" | "CHUNK_LOD", enabled: boolean) => void;
}
