export type AreaType =
  | "ROAD" | "SIDEWALK" | "ALLEY" | "INTERSECTION"
  | "PLAZA" | "PARK" | "BUILDING" | "BUILDING_ENTRANCE"
  | "ROOM" | "CORRIDOR" | "STAIR" | "DEAD_END"
  | "CONTROL_ROOM" | "STORAGE" | "OFFICE" | "LIVING_ROOM"
  | "ROOFTOP" | "GOAL_AREA" | "START"
  | "ITEM" | "ENEMY_SPAWN" | "NPC_SPAWN";

export type AreaTag =
  | "indoor" | "outdoor" | "public" | "private" | "safe" | "danger"
  | "wide" | "narrow" | "dead_end" | "high_floor" | "ground_floor"
  | "landmark" | "dark" | "bright" | "room" | "spawn" | "mission";

export interface WorldPosition { x: number; y: number; z: number }

export interface WorldBounds {
  minX: number; maxX: number;
  minY: number; maxY: number;
  minZ: number; maxZ: number;
}

export interface WorldArea {
  id: string;
  type: AreaType;
  position: WorldPosition;
  bounds: WorldBounds;
  floor?: number;
  buildingId?: string;
  roomId?: string;
  connections: string[];
  tags: AreaTag[];
  importance?: number;
  metadata?: Record<string, string | number | boolean>;
}

export interface SemanticLocation {
  area?: WorldArea;
  building?: string;
  floor?: number;
  room?: string;
}

export interface WorldStatistics {
  roads: number;
  buildings: number;
  rooms: number;
  deadEnds: number;
  safeAreas: number;
  dangerAreas: number;
  enemySpawns: number;
  npcSpawns: number;
}

export interface MapArea2D {
  id: string;
  type: AreaType;
  x: number;
  z: number;
  width: number;
  depth: number;
  floor?: number;
  tags: AreaTag[];
}

export function createBounds(position: WorldPosition, width: number, depth: number, minY = 0, maxY = 3): WorldBounds {
  return {
    minX: position.x - width / 2, maxX: position.x + width / 2,
    minY, maxY,
    minZ: position.z - depth / 2, maxZ: position.z + depth / 2,
  };
}

