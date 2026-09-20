import { SeededRandom } from "../random/seededRandom";
import { createBounds } from "../world/SemanticTypes";
import { chunkId, chunkSeed, type MapObjectData, type MapSemanticData, type WorldChunkData } from "./WorldMapData";

export function generateChunkData(worldSeed: number, x: number, z: number, chunkSize: number, style: string): WorldChunkData {
  const id = chunkId(x, z); const seed = chunkSeed(worldSeed, x, z); const random = new SeededRandom(seed); const cx = x * chunkSize; const cz = z * chunkSize;
  const objects: MapObjectData[] = [
    object(`${id}_ground`, "GROUND", cx, .005, cz, chunkSize, .02, chunkSize, "#31483c"),
    object(`${id}_road_ns_mesh`, "ROAD_NS", cx, .035, cz, 8, .05, chunkSize, "#2a3036"),
    object(`${id}_road_ew_mesh`, "ROAD_EW", cx, .04, cz, chunkSize, .05, 8, "#2a3036"),
  ];
  const semantics: MapSemanticData[] = [];
  const roadNs = `${id}_road_ns`; const roadEw = `${id}_road_ew`;
  semantics.push(semantic(roadNs, "ROAD", cx, 0, cz, 8, chunkSize, [`${chunkId(x, z - 1)}_road_ns`, `${chunkId(x, z + 1)}_road_ns`, roadEw], ["outdoor", "public", "wide"]));
  semantics.push(semantic(roadEw, "ROAD", cx, 0, cz, chunkSize, 8, [`${chunkId(x - 1, z)}_road_ew`, `${chunkId(x + 1, z)}_road_ew`, roadNs], ["outdoor", "public", "wide"]));
  const offsets = [-1, 1]; let buildingIndex = 0;
  for (const sx of offsets) for (const sz of offsets) {
    if (random.next() < .18) continue; const width = random.range(8, 13); const depth = random.range(8, 13); const height = random.range(5, style.includes("future") ? 22 : 14);
    const px = cx + sx * random.range(15, chunkSize / 2 - 10); const pz = cz + sz * random.range(15, chunkSize / 2 - 10); const buildingId = `${id}_building_${++buildingIndex}`;
    objects.push(object(buildingId, "BUILDING", px, height / 2, pz, width, height, depth, random.pick(["#54717a", "#7a6654", "#59677c", "#6d7456"])));
    semantics.push({ ...semantic(buildingId, "BUILDING", px, 0, pz, width, depth, [], ["private"], height), metadata: { generated: true, chunkId: id, height } });
  }
  return { id, x, z, seed, state: "UNLOADED", source: "PROCEDURAL", objects, semantics, edges: { northConnections: [0], southConnections: [0], eastConnections: [0], westConnections: [0] }, metadata: { style } };
}

function object(id: string, type: MapObjectData["type"], x: number, y: number, z: number, sx: number, sy: number, sz: number, color: string): MapObjectData { return { id, type, position: { x, y, z }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: sx, y: sy, z: sz }, color }; }
function semantic(id: string, type: MapSemanticData["type"], x: number, y: number, z: number, width: number, depth: number, connections: string[], tags: MapSemanticData["tags"], height = 4): MapSemanticData { return { id, type, position: { x, y, z }, bounds: createBounds({ x, y, z }, width, depth, 0, height), connections, tags }; }
