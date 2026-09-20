import type { AreaTag, AreaType, WorldBounds, WorldPosition } from "../world/SemanticTypes";

export type WorldMapMode = "PROCEDURAL" | "PREBUILT" | "HYBRID";
export type WorldChunkState = "UNLOADED" | "LOADING" | "GENERATING" | "READY" | "ERROR";
export type ChunkEdge = "north" | "south" | "east" | "west";

export interface MapObjectData {
  id: string;
  type: "GROUND" | "ROAD_NS" | "ROAD_EW" | "BUILDING";
  position: WorldPosition;
  rotation: WorldPosition;
  scale: WorldPosition;
  color: string;
  parameters?: Record<string, string | number | boolean>;
}

export interface MapSemanticData {
  id: string;
  type: AreaType;
  position: WorldPosition;
  bounds: WorldBounds;
  connections: string[];
  tags: AreaTag[];
  importance?: number;
  metadata?: Record<string, string | number | boolean>;
}

export interface ChunkEdgeMetadata {
  northConnections: number[];
  southConnections: number[];
  eastConnections: number[];
  westConnections: number[];
}

export interface WorldChunkData {
  id: string;
  x: number;
  z: number;
  seed: number;
  state: WorldChunkState;
  source: "PREBUILT" | "PROCEDURAL";
  objects: MapObjectData[];
  semantics: MapSemanticData[];
  edges: ChunkEdgeMetadata;
  metadata: Record<string, string | number | boolean>;
}

export interface WorldMapData {
  mapFormatVersion: number;
  frameworkVersion: string;
  mapId: string;
  mapName: string;
  seed: number;
  worldStyle: string;
  mode: WorldMapMode;
  chunkSize: number;
  chunks: WorldChunkData[];
  metadata: { createdAt: string; updatedAt: string; autoExpansion: boolean; chunkUnload: boolean; loadRadius: number; unloadRadius: number };
}

export interface MapStateSnapshot {
  mode: WorldMapMode;
  worldSeed: number;
  currentChunk: { x: number; z: number; id: string };
  loadedChunks: string[];
  totalChunks: number;
  autoExpansion: boolean;
  chunkUnload: boolean;
  generating: boolean;
  chunkSize: number;
  triggerDistance: number;
  lastError?: string;
}

export function chunkId(x: number, z: number): string { return `chunk_${x}_${z}`; }
export function chunkSeed(worldSeed: number, x: number, z: number): number {
  let hash = worldSeed >>> 0; hash ^= Math.imul(x, 0x9e3779b1); hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b); hash ^= Math.imul(z, 0xc2b2ae35); return (hash ^ (hash >>> 13)) >>> 0 || 1;
}
