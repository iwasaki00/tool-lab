import type { Camera } from "@babylonjs/core/Cameras/camera";
import type { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { CharacterManager, CharacterManagerDebug } from "../characters/CharacterManager";
import type { DebugCommand, DebugTestSnapshot } from "../debug/DebugTestManager";
import type { DiscoverySnapshot } from "../gameplay/DiscoveryManager";
import type { EventManager } from "../gameplay/EventManager";
import type { InventoryEntry } from "../gameplay/InventoryManager";
import type { MissionPlan } from "../gameplay/MissionGenerator";
import type { MissionGuideDebugInfo, MissionGuideMode } from "../gameplay/MissionGuideManager";
import type { MissionDifficulty, MissionResult, MissionRuntimeSnapshot, MissionType } from "../gameplay/MissionTypes";
import type { MissionValidation } from "../gameplay/MissionValidator";
import type { InteriorBuildingSite, InteriorNavigation } from "../interior/Room";
import type { InteractionFocus } from "../interaction/Interactable";
import type { InteractionManager } from "../interaction/InteractionManager";
import type { ObjectContext } from "../objects/primitives";
import type { SemanticLocation, WorldStatistics } from "../world/SemanticTypes";
import type { WorldRegistry } from "../world/WorldRegistry";
import type { FrameworkEventMap } from "./FrameworkEvents";
import type { INavigationService } from "./ServiceContracts";

export interface GameplayCallbacks {
  onFocus: (focus?: InteractionFocus) => void;
  onMessage: (message: string) => void;
  onObjective: (objective: string) => void;
  onInventory: (items: InventoryEntry[]) => void;
  onMissionState: (state: MissionRuntimeSnapshot) => void;
  onMissionComplete: (result: MissionResult) => void;
  onPlayerCaught?: (id: string) => void;
  onDiscovery?: (snapshot: DiscoverySnapshot) => void;
}

export interface ScenarioPolicy {
  enemyCount: number;
  npcCount: number;
  discoveryEnabled: boolean;
}

export interface LaboratoryScenario {
  interactionService: InteractionManager;
  interact: () => void;
  focus: () => InteractionFocus | undefined;
  inventory: () => InventoryEntry[];
  objective: () => string;
  navigation: () => InteriorNavigation | undefined;
  semanticLocation: () => SemanticLocation;
  worldStatistics: () => WorldStatistics;
  mission: () => { plan: MissionPlan; validation: MissionValidation; state: MissionRuntimeSnapshot };
  guideDebug: () => MissionGuideDebugInfo;
  setGuideMode: (mode: MissionGuideMode) => void;
  setDayMode: (isDay: boolean) => void;
  setDebugMode: (visible: boolean) => void;
  setEnemyAI: (enabled: boolean) => void;
  characterDebug: () => CharacterManagerDebug;
  setNavigationTest: (enabled: boolean) => void;
  setPaused: (paused: boolean) => void;
  discovery: () => DiscoverySnapshot;
  debugTest: () => DebugTestSnapshot;
  debugCommand: (command: DebugCommand, value?: string | number) => void;
  debugJumpTo: (stepId: string) => void;
  setDebugSelectMode: (enabled: boolean) => void;
  debugEnemy: (command: Parameters<CharacterManager["debugEnemy"]>[0]) => void;
  debugDiscovery: (command: "current" | "all" | "reset") => void;
  setSimulationSpeed: (scale: number) => void;
  dispose: () => void;
}

export type ScenarioFactory = (
  ctx: ObjectContext, camera: Camera, spawn: Vector3, callbacks: GameplayCallbacks, registry: WorldRegistry,
  cityInteriorSites?: InteriorBuildingSite[], citySeed?: number, missionSeed?: number, missionType?: MissionType,
  missionDifficulty?: MissionDifficulty, mobile?: boolean, setPlayerInputEnabled?: (enabled: boolean) => void,
  navigation?: INavigationService, scenarioPolicy?: ScenarioPolicy, frameworkEvents?: EventManager<FrameworkEventMap>,
) => LaboratoryScenario;
