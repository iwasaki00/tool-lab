import { MAP_FORMAT_VERSION } from "../core/version";
import type { WorldMapData } from "./WorldMapData";

export function migrateMapData(input: unknown): WorldMapData {
  if (!input || typeof input !== "object") throw new Error("INVALID MAP DATA");
  const candidate = structuredClone(input) as Partial<WorldMapData>;
  const version = Number(candidate.mapFormatVersion);
  if (!Number.isInteger(version) || version < 1) throw new Error("INVALID MAP FORMAT VERSION");
  if (version > MAP_FORMAT_VERSION) throw new Error("UNSUPPORTED MAP VERSION");
  // Future migrations are applied here sequentially: v1 -> v2 -> ...
  if (!candidate.mapId || !candidate.mapName || !Number.isFinite(candidate.seed) || !Array.isArray(candidate.chunks)) throw new Error("INVALID MAP DATA");
  return candidate as WorldMapData;
}
