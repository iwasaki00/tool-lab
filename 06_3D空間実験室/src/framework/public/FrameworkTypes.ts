import type { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { FrameworkConfig } from "../../bootstrap/FrameworkConfig";
import type { FrameworkEventMap } from "./FrameworkEvents";
import type { IInteractionService, IMapService, INavigationService, IWorldService } from "../../contracts/ServiceContracts";
import type { MapStateSnapshot, WorldMapData } from "../../map/WorldMapData";
import type { MovementSettings } from "../../player/movementSettings";
import type { EnvironmentPreset, VisualQuality, VisualState } from "../../visual/VisualConfig";
import type { CitySettings, WorldMode } from "../../world/types";

export type CanonicalFeatureId = "worldMap" | "chunkStreaming" | "interiors" | "navigation" | "interaction" | "missions" | "inventory" | "npc" | "enemies" | "dialogue" | "missionGuide" | "dayNight" | "vegetation" | "debugTools";
/** `map` is retained as a compatibility alias for `worldMap`. */
export type FeatureId = CanonicalFeatureId | "map";
export type FeatureProfile = "MINIMAL" | "EXPLORATION" | "FULL";
export type FrameworkLifecycleState = "CREATED" | "INITIALIZING" | "RUNNING" | "DISPOSED" | "ERROR";

export interface WorldCreateOptions {
  mode?: WorldMode;
  city?: Partial<CitySettings>;
}

export interface MapLoadOptions {
  autoExpansion?: boolean;
  chunkUnload?: boolean;
}

export type FrameworkFeatureOptions = Partial<Record<FeatureId, boolean>>;

export interface CreateFrameworkOptions {
  canvas: HTMLCanvasElement | string;
  mobile?: boolean;
  config?: Partial<FrameworkConfig>;
  world?: WorldCreateOptions;
  profile?: FeatureProfile;
  features?: FrameworkFeatureOptions;
}

export interface FrameworkEventApi {
  on<TKey extends keyof FrameworkEventMap>(event: TKey, listener: (payload: FrameworkEventMap[TKey]) => void): () => void;
  emit<TKey extends keyof FrameworkEventMap>(event: TKey, payload: FrameworkEventMap[TKey]): void;
}

export interface FrameworkPlayerApi {
  getPosition(): Vector3;
  setPosition(position: Vector3): void;
  setMovementSpeeds(settings: MovementSettings): void;
  setInputEnabled(enabled: boolean): void;
  setMoveInput(x: number, y: number): void;
  setSprinting(active: boolean): void;
  rotate(deltaX: number, deltaY: number): void;
  jump(): void;
}

export interface FrameworkVisualApi {
  getState(): VisualState;
  setEnvironment(preset: EnvironmentPreset): void;
  setQuality(quality: VisualQuality): void;
}

export interface FrameworkFeatureAccess {
  readonly profile: FeatureProfile;
  has(id: FeatureId): boolean;
  isEnabled(id: FeatureId): boolean;
  enabled(): FeatureId[];
  disabled(): FeatureId[];
  reason(id: FeatureId): string | undefined;
}

export interface FrameworkState {
  frameworkVersion: string;
  mapFormatVersion: number;
  lifecycle: FrameworkLifecycleState;
  features: FeatureId[];
  worldAreaCount: number;
  map?: MapStateSnapshot;
  error?: string;
}

export interface FrameworkApi {
  initialize(): Promise<void>;
  start(): Promise<void>;
  dispose(): void;
  restartSession(options?: WorldCreateOptions): Promise<void>;
  loadMap(input: unknown, options?: MapLoadOptions): Promise<WorldMapData>;
  createProceduralMap(seed?: number, style?: string): WorldMapData;
  getWorld(): IWorldService;
  getPlayer(): FrameworkPlayerApi;
  getNavigation(): INavigationService | undefined;
  getInteraction(): IInteractionService | undefined;
  getEvents(): FrameworkEventApi;
  getVisual(): FrameworkVisualApi;
  getMap(): IMapService | undefined;
  getFeatures(): FrameworkFeatureAccess;
  getState(): FrameworkState;
}

export type { FrameworkConfig } from "../../bootstrap/FrameworkConfig";
export type { FrameworkEventMap, FrameworkEventName } from "./FrameworkEvents";
export type { WorldMapData } from "../../map/WorldMapData";
