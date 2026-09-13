import type { Mesh } from "@babylonjs/core/Meshes/mesh";

export type RoomType = "EMPTY" | "OFFICE" | "STORAGE" | "CONTROL_ROOM" | "LIVING_ROOM";
export type InteriorGenerationState = "NOT_GENERATED" | "GENERATED";

export interface LocalBounds {
  minX: number; maxX: number; minZ: number; maxZ: number;
}

export interface RoomData {
  id: string;
  type: RoomType;
  floor: number;
  bounds: LocalBounds;
  doors: string[];
  connections: string[];
}

export interface FloorData {
  floor: number;
  corridor: LocalBounds;
  rooms: RoomData[];
  staircase?: LocalBounds;
}

export interface InteriorBuildingSite {
  id: string;
  root: Mesh;
  width: number;
  depth: number;
  floors: number;
  floorHeight: number;
  seed: number;
  state: InteriorGenerationState;
  mission?: boolean;
  floorData?: FloorData[];
}

export interface InteriorNavigation {
  building: string;
  floor: number;
  room: string;
}
