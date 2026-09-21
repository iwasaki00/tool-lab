import type { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { MapArea2D, SemanticLocation, WorldArea, WorldPosition, WorldStatistics } from "../world/SemanticTypes";
import type { MapStateSnapshot, WorldMapData } from "../map/WorldMapData";
import type { InteractionFocus, Interactable } from "../interaction/Interactable";

export type NavigationStatus = "BUILDING" | "READY" | "FALLBACK" | "ERROR";
export type NavigationMode = "NAVMESH" | "WORLD_GRAPH" | "DIRECT_FALLBACK";
export interface NavigationStats {
  status: NavigationStatus;
  mode: NavigationMode;
  triangles: number;
  buildTime: number;
  pathFailures: number;
  validation: string;
  error: string;
  stack: string;
  targetMeshCount: number;
  walkableMeshCount: number;
  obstacleMeshCount: number;
  buildParameters: string;
}

export interface IWorldService {
  get(id: string): WorldArea | undefined;
  getAll(): WorldArea[];
  getNearestArea(position: WorldPosition): WorldArea | undefined;
  getLocationAt(position: WorldPosition): SemanticLocation;
  getStatistics(): WorldStatistics;
  toMap2D(floor?: number): MapArea2D[];
}

export interface INavigationService {
  isReady(): boolean;
  stats(): NavigationStats;
  findPath(start: Vector3, goal: Vector3): Vector3[];
  getNearestWalkablePoint(position: Vector3): Vector3;
  isReachable(start: Vector3, goal: Vector3): boolean;
  closestPoint(position: Vector3): Vector3;
  randomPoint(position: Vector3, radius: number): Vector3;
  pathLength(path: Vector3[]): number;
  showPath(id: string, path: Vector3[], color?: import("@babylonjs/core/Maths/math.color").Color3): void;
  clearPath(id: string): void;
  clearAllPaths(): void;
  setDebugVisible(visible: boolean): void;
  requestRebuild(): void;
  retry(): void;
}

export interface IInteractionService {
  register(target: Interactable): () => void;
  interact(): void;
  getDebugInfo(): InteractionFocus | undefined;
}

export interface IInventoryService {
  add(id: string, name: string, amount?: number): void;
  has(id: string, amount?: number): boolean;
}

export interface IEventService {
  on(eventId: string, listener: () => void): () => void;
  emit(eventId: string): void;
}

export interface IMapService {
  snapshot(): MapStateSnapshot;
  saveMap(): WorldMapData;
  createProceduralMap(seed?: number, style?: string): WorldMapData;
  loadMap(input: unknown): Promise<WorldMapData>;
  setAutoExpansion(enabled: boolean): void;
  setChunkUnload(enabled: boolean): void;
}
