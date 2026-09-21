import type { Camera } from "@babylonjs/core/Cameras/camera";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { Observer } from "@babylonjs/core/Misc/observable";
import type { Scene } from "@babylonjs/core/scene";
import { FRAMEWORK_VERSION, MAP_FORMAT_VERSION } from "../core/version";
import type { ObjectContext } from "../objects/primitives";
import type { WorldRegistry } from "../world/WorldRegistry";
import { generateChunkData } from "./ChunkGenerator";
import { migrateMapData } from "./MapMigration";
import { chunkId, chunkSeed, type MapObjectData, type MapStateSnapshot, type WorldChunkData, type WorldMapData, type WorldMapMode } from "./WorldMapData";
import type { IMapService } from "../contracts/ServiceContracts";
import type { MapStatusEvent } from "../contracts/FrameworkEvents";

interface ChunkRuntime { data: WorldChunkData; meshes: Mesh[]; materials: StandardMaterial[]; debug: Mesh[]; loaded: boolean }
const STORAGE_INDEX = "3d-space-lab-maps";

export class WorldMapManager implements IMapService {
  private readonly chunks = new Map<string, ChunkRuntime>();
  private readonly observer: Observer<Scene>;
  private mode: WorldMapMode = "PROCEDURAL";
  private mapId: string;
  private mapName = "Procedural World";
  private autoExpansion = true;
  private unloadEnabled = true;
  private generating = false;
  private debugVisible = false;
  private lastUpdate = 0;
  private lastSafePosition: Vector3;
  private lastError = "";
  readonly chunkSize = 96;
  readonly triggerDistance = 16;
  readonly loadRadius: number;
  readonly unloadRadius: number;

  constructor(private readonly ctx: ObjectContext, private readonly registry: WorldRegistry, private readonly camera: Camera, private worldSeed: number, private worldStyle: string, private readonly navigationChanged: () => void, mobile = false, private readonly onStatus: (event: MapStatusEvent) => void = () => undefined) {
    this.loadRadius = mobile ? 1 : 2; this.unloadRadius = mobile ? 2 : 3;
    this.mapId = `map_${worldSeed}`; this.lastSafePosition = camera.position.clone();
    const origin: WorldChunkData = { id: chunkId(0, 0), x: 0, z: 0, seed: chunkSeed(worldSeed, 0, 0), state: "READY", source: "PREBUILT", objects: [], semantics: [], edges: { northConnections: [0], southConnections: [0], eastConnections: [0], westConnections: [0] }, metadata: { baseWorld: true, style: worldStyle } };
    this.chunks.set(origin.id, { data: origin, meshes: [], materials: [], debug: [], loaded: true });
    this.observer = ctx.scene.onBeforeRenderObservable.add(() => this.update())!;
    this.updateStatus();
  }

  snapshot(): MapStateSnapshot { const current = this.coordinates(this.camera.position); return { mode: this.mode, worldSeed: this.worldSeed, currentChunk: { ...current, id: chunkId(current.x, current.z) }, loadedChunks: [...this.chunks.values()].filter((item) => item.loaded).map((item) => item.data.id), totalChunks: this.chunks.size, autoExpansion: this.autoExpansion, chunkUnload: this.unloadEnabled, generating: this.generating, chunkSize: this.chunkSize, triggerDistance: this.triggerDistance, lastError: this.lastError || undefined }; }
  getLoadedChunks(): string[] { return this.snapshot().loadedChunks; }
  setAutoExpansion(enabled: boolean): void { this.autoExpansion = enabled; if (this.mode === "PREBUILT" && enabled) this.mode = "HYBRID"; this.updateStatus(); }
  setChunkUnload(enabled: boolean): void { this.unloadEnabled = enabled; if (!enabled) void this.loadAllKnown(); this.updateStatus(); }
  setDebugVisible(visible: boolean): void { this.debugVisible = visible; this.chunks.forEach((chunk) => { if (chunk.loaded) this.refreshDebug(chunk); }); }

  saveMap(): WorldMapData {
    const now = new Date().toISOString(); return { mapFormatVersion: MAP_FORMAT_VERSION, frameworkVersion: FRAMEWORK_VERSION, mapId: this.mapId, mapName: this.mapName, seed: this.worldSeed, worldStyle: this.worldStyle, mode: this.mode, chunkSize: this.chunkSize, chunks: [...this.chunks.values()].map((item) => ({ ...structuredClone(item.data), state: "UNLOADED" })), metadata: { createdAt: now, updatedAt: now, autoExpansion: this.autoExpansion, chunkUnload: this.unloadEnabled, loadRadius: this.loadRadius, unloadRadius: this.unloadRadius } };
  }

  createProceduralMap(seed = this.worldSeed, style = this.worldStyle): WorldMapData {
    this.disposeStreamedChunks(); this.worldSeed = seed; this.worldStyle = style; this.mode = "PROCEDURAL"; this.mapId = `map_${seed}`; this.mapName = "Procedural World"; this.lastError = "";
    const origin: WorldChunkData = { id: chunkId(0, 0), x: 0, z: 0, seed: chunkSeed(seed, 0, 0), state: "READY", source: "PREBUILT", objects: [], semantics: [], edges: { northConnections: [0], southConnections: [0], eastConnections: [0], westConnections: [0] }, metadata: { baseWorld: true, style } };
    this.chunks.set(origin.id, { data: origin, meshes: [], materials: [], debug: [], loaded: true }); this.lastSafePosition.copyFrom(this.camera.position); this.updateStatus(); return this.saveMap();
  }

  async loadMap(input: unknown): Promise<WorldMapData> {
    const map = migrateMapData(input); this.disposeStreamedChunks(); this.worldSeed = map.seed; this.worldStyle = map.worldStyle; this.mapId = map.mapId; this.mapName = map.mapName; this.autoExpansion = map.metadata.autoExpansion; this.unloadEnabled = map.metadata.chunkUnload; this.mode = this.autoExpansion ? "HYBRID" : "PREBUILT";
    map.chunks.forEach((data) => this.chunks.set(data.id, { data: { ...structuredClone(data), state: "UNLOADED", source: "PREBUILT" }, meshes: [], materials: [], debug: [], loaded: false }));
    if (!this.chunks.has(chunkId(0, 0))) this.chunks.set(chunkId(0, 0), { data: generateChunkData(this.worldSeed, 0, 0, this.chunkSize, this.worldStyle), meshes: [], materials: [], debug: [], loaded: false });
    await this.loadNearby(); this.updateStatus(); return map;
  }

  saveToBrowser(name = this.mapName): WorldMapData { this.mapName = name.trim() || this.mapName; const map = this.saveMap(); localStorage.setItem(`3d-space-lab-map:${map.mapId}`, JSON.stringify(map)); const index = this.listBrowserMaps().filter((item) => item.mapId !== map.mapId); index.unshift(summary(map)); localStorage.setItem(STORAGE_INDEX, JSON.stringify(index.slice(0, 12))); return map; }
  listBrowserMaps(): Array<{ mapId: string; mapName: string; mapFormatVersion: number; seed: number; chunkCount: number }> { try { return JSON.parse(localStorage.getItem(STORAGE_INDEX) ?? "[]") as ReturnType<WorldMapManager["listBrowserMaps"]>; } catch { return []; } }
  loadFromBrowser(id: string): WorldMapData { const value = localStorage.getItem(`3d-space-lab-map:${id}`); if (!value) throw new Error("MAP NOT FOUND"); return migrateMapData(JSON.parse(value)); }
  deleteFromBrowser(id: string): void { localStorage.removeItem(`3d-space-lab-map:${id}`); localStorage.setItem(STORAGE_INDEX, JSON.stringify(this.listBrowserMaps().filter((item) => item.mapId !== id))); }

  teleportNearChunkEdge(direction: "north" | "south" | "east" | "west", cross = false): void {
    const current = this.coordinates(this.camera.position); const center = new Vector3(current.x * this.chunkSize, this.camera.position.y, current.z * this.chunkSize); const offset = this.chunkSize / 2 + (cross ? 2 : -Math.max(2, this.triggerDistance - 2));
    if (direction === "north") center.z -= offset; if (direction === "south") center.z += offset; if (direction === "east") center.x += offset; if (direction === "west") center.x -= offset; this.camera.position.copyFrom(center); this.update(true);
  }

  async ensureChunk(x: number, z: number): Promise<WorldChunkData> {
    const id = chunkId(x, z); let runtime = this.chunks.get(id);
    if (!runtime) { const data = generateChunkData(this.worldSeed, x, z, this.chunkSize, this.worldStyle); runtime = { data, meshes: [], materials: [], debug: [], loaded: false }; this.chunks.set(id, runtime); }
    if (!runtime.loaded) await this.loadChunk(runtime); return runtime.data;
  }

  dispose(): void { this.ctx.scene.onBeforeRenderObservable.remove(this.observer); this.chunks.forEach((chunk) => this.unloadChunk(chunk, true)); this.chunks.clear(); this.updateStatus(); }

  private update(force = false): void {
    const now = performance.now(); if (!force && now - this.lastUpdate < 220) return; this.lastUpdate = now;
    const current = this.coordinates(this.camera.position); const currentRuntime = this.chunks.get(chunkId(current.x, current.z));
    if (!this.autoExpansion && (!currentRuntime || !currentRuntime.loaded)) { this.camera.position.copyFrom(this.lastSafePosition); this.showBoundary(); return; }
    if (currentRuntime?.loaded) this.lastSafePosition.copyFrom(this.camera.position);
    if (this.autoExpansion) void this.preloadEdges(current.x, current.z);
    if (this.unloadEnabled) this.unloadFar(current.x, current.z);
    this.updateStatus();
  }

  private async preloadEdges(x: number, z: number): Promise<void> {
    const localX = this.camera.position.x - x * this.chunkSize; const localZ = this.camera.position.z - z * this.chunkSize; const edge = this.chunkSize / 2; const candidates: Array<{ x: number; z: number; score: number }> = [];
    if (edge - localX < this.triggerDistance) candidates.push({ x: x + 1, z, score: 1 }); if (edge + localX < this.triggerDistance) candidates.push({ x: x - 1, z, score: 1 }); if (edge - localZ < this.triggerDistance) candidates.push({ x, z: z + 1, score: 1 }); if (edge + localZ < this.triggerDistance) candidates.push({ x, z: z - 1, score: 1 });
    const forward = this.camera.getForwardRay().direction; candidates.forEach((item) => { item.score += Math.max(0, forward.x * (item.x - x) + forward.z * (item.z - z)); }); candidates.sort((a, b) => b.score - a.score);
    for (const item of candidates) await this.ensureChunk(item.x, item.z);
  }

  private async loadChunk(runtime: ChunkRuntime): Promise<void> {
    if (runtime.loaded || runtime.data.state === "LOADING" || runtime.data.state === "GENERATING") return; this.generating = true; runtime.data.state = runtime.data.objects.length ? "LOADING" : "GENERATING"; this.updateStatus(); await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    try { if (!runtime.data.objects.length && !runtime.data.metadata.baseWorld) runtime.data = generateChunkData(this.worldSeed, runtime.data.x, runtime.data.z, this.chunkSize, this.worldStyle); this.instantiate(runtime); runtime.data.state = "READY"; runtime.loaded = true; this.connectEdges(runtime.data); this.refreshDebug(runtime); this.navigationChanged(); }
    catch (error) { runtime.data.state = "ERROR"; this.lastError = error instanceof Error ? error.message : String(error); console.error("CHUNK GENERATION ERROR", { chunk: runtime.data.id, error }); }
    finally { this.generating = [...this.chunks.values()].some((item) => item.data.state === "LOADING" || item.data.state === "GENERATING"); this.updateStatus(); }
  }

  private instantiate(runtime: ChunkRuntime): void {
    runtime.data.objects.forEach((data) => { const color = Color3.FromHexString(data.color); const shared = this.ctx.materials; const material = data.type.startsWith("ROAD") ? shared?.getRoadMaterial(color) : data.type === "GROUND" ? shared?.getGroundMaterial("chunk-ground", color) : shared?.getBuildingMaterial(String(data.parameters?.visualStyle ?? "GENERIC"), color); const owned = material ?? new StandardMaterial(`${data.id}-material`, this.ctx.scene); if (!material) { owned.diffuseColor = color; owned.specularColor = color.scale(.08); runtime.materials.push(owned); } const mesh = meshFromData(this.ctx.scene, data); mesh.material = owned; mesh.checkCollisions = data.type === "BUILDING"; mesh.receiveShadows = true; mesh.metadata = { mapChunkId: runtime.data.id, mapObjectId: data.id, visualLod: 2 }; if (data.type === "BUILDING") { this.ctx.shadows.addShadowCaster(mesh); runtime.meshes.push(...createBuildingDetails(this.ctx, data, mesh)); } runtime.meshes.push(mesh); });
    runtime.data.semantics.forEach((area) => this.registry.register(structuredClone(area)));
  }

  private connectEdges(data: WorldChunkData): void { data.semantics.forEach((area) => area.connections.forEach((target) => { if (this.registry.get(target)) this.registry.connect(area.id, target); })); }
  private unloadFar(x: number, z: number): void { let changed = false; this.chunks.forEach((chunk) => { if (!chunk.loaded || chunk.data.metadata.baseWorld) return; if (Math.max(Math.abs(chunk.data.x - x), Math.abs(chunk.data.z - z)) > this.unloadRadius) { this.unloadChunk(chunk); changed = true; } }); if (changed) this.navigationChanged(); }
  private unloadChunk(runtime: ChunkRuntime, force = false): void { if (!runtime.loaded && !force) return; runtime.meshes.splice(0).forEach((mesh) => mesh.dispose()); runtime.materials.splice(0).forEach((material) => material.dispose()); runtime.debug.splice(0).forEach((mesh) => mesh.dispose(false, true)); runtime.data.semantics.forEach((area) => this.registry.remove(area.id)); runtime.loaded = false; runtime.data.state = "UNLOADED"; }
  private disposeStreamedChunks(): void { this.chunks.forEach((chunk) => { if (!chunk.data.metadata.baseWorld) this.unloadChunk(chunk, true); }); this.chunks.clear(); }
  private async loadNearby(): Promise<void> { const current = this.coordinates(this.camera.position); const known = [...this.chunks.values()].filter((chunk) => Math.max(Math.abs(chunk.data.x - current.x), Math.abs(chunk.data.z - current.z)) <= this.loadRadius); for (const chunk of known) await this.loadChunk(chunk); }
  private async loadAllKnown(): Promise<void> { for (const chunk of this.chunks.values()) await this.loadChunk(chunk); }
  private coordinates(position: { x: number; z: number }): { x: number; z: number } { return { x: Math.floor((position.x + this.chunkSize / 2) / this.chunkSize), z: Math.floor((position.z + this.chunkSize / 2) / this.chunkSize) }; }
  private showBoundary(): void { this.onStatus({ state: "BOUNDARY", message: "MAP BOUNDARY" }); }
  private updateStatus(): void { this.onStatus(this.lastError ? { state: "ERROR", message: this.lastError } : this.generating ? { state: "LOADING", message: "GENERATING AREA..." } : { state: "IDLE", message: "" }); }
  private refreshDebug(runtime: ChunkRuntime): void { runtime.debug.splice(0).forEach((mesh) => mesh.dispose(false, true)); if (!this.debugVisible) return; const half = this.chunkSize / 2; const cx = runtime.data.x * this.chunkSize; const cz = runtime.data.z * this.chunkSize; const points = [new Vector3(cx - half, .15, cz - half), new Vector3(cx + half, .15, cz - half), new Vector3(cx + half, .15, cz + half), new Vector3(cx - half, .15, cz + half), new Vector3(cx - half, .15, cz - half)]; const line = MeshBuilder.CreateLines(`${runtime.data.id}-boundary`, { points }, this.ctx.scene); line.color = new Color3(.1, 1, .75); line.isPickable = false; runtime.debug.push(line); const texture = new DynamicTexture(`${runtime.data.id}-label-texture`, { width: 256, height: 96 }, this.ctx.scene, false); texture.hasAlpha = true; texture.drawText(`${runtime.data.x},${runtime.data.z}`, null, 66, "bold 42px monospace", "#baffef", "rgba(3,18,24,.82)", true); const label = MeshBuilder.CreatePlane(`${runtime.data.id}-label`, { width: 7, height: 2.6 }, this.ctx.scene); label.position.set(cx, 5, cz); label.billboardMode = Mesh.BILLBOARDMODE_ALL; label.isPickable = false; const material = new StandardMaterial(`${runtime.data.id}-label-material`, this.ctx.scene); material.diffuseTexture = texture; material.opacityTexture = texture; material.emissiveColor = Color3.White(); material.disableLighting = true; label.material = material; runtime.debug.push(label); }
}

function meshFromData(scene: Scene, data: MapObjectData): Mesh { const mesh = MeshBuilder.CreateBox(data.id, { width: data.scale.x, height: data.scale.y, depth: data.scale.z }, scene); mesh.position.set(data.position.x, data.position.y, data.position.z); mesh.rotation.set(data.rotation.x, data.rotation.y, data.rotation.z); return mesh; }
function createBuildingDetails(ctx: ObjectContext, data: MapObjectData, body: Mesh): Mesh[] {
  const result: Mesh[] = []; const roofStyle = String(data.parameters?.roofStyle ?? "FLAT"); const roof = roofStyle === "SLOPE" ? MeshBuilder.CreateCylinder(`${data.id}-roof`, { height: data.scale.z + .25, diameter: data.scale.x * .72, tessellation: 3 }, ctx.scene) : MeshBuilder.CreateBox(`${data.id}-roof`, { width: data.scale.x + .35, height: roofStyle === "STEP" ? .65 : .24, depth: data.scale.z + .35 }, ctx.scene);
  roof.parent = body; roof.position.y = data.scale.y / 2 + (roofStyle === "STEP" ? .32 : .12); if (roofStyle === "SLOPE") { roof.rotation.x = Math.PI / 2; roof.rotation.y = Math.PI / 2; roof.position.y = data.scale.y / 2 + data.scale.x * .2; } roof.material = ctx.materials?.getRoofMaterial(roofStyle, Color3.FromHexString(data.color).scale(.48)) ?? body.material; roof.metadata = { mapChunkId: body.metadata.mapChunkId, visualLod: 1 }; result.push(roof);
  const glass = ctx.materials?.getGlassMaterial() ?? body.material; const rows = Math.max(1, Math.min(4, Math.floor(data.scale.y / 3))); const columns = Math.max(2, Math.min(4, Math.floor(data.scale.x / 2.5))); const parts: Mesh[] = [];
  for (let row = 0; row < rows; row += 1) for (let column = 0; column < columns; column += 1) { const pane = MeshBuilder.CreateBox(`${data.id}-window-part`, { width: .75, height: .85, depth: .06 }, ctx.scene); pane.position.set(-data.scale.x / 2 + (column + 1) * data.scale.x / (columns + 1), -data.scale.y / 2 + 1.5 + row * Math.min(2.7, data.scale.y / rows), -data.scale.z / 2 - .04); pane.material = glass; parts.push(pane); }
  const windows = parts.length ? Mesh.MergeMeshes(parts, true, true, undefined, false, false) : null; if (windows) { windows.name = `${data.id}-windows`; windows.parent = body; windows.metadata = { mapChunkId: body.metadata.mapChunkId, visualRole: "window", visualLod: 0, windowPattern: data.parameters?.windowPattern }; result.push(windows); }
  const door = MeshBuilder.CreateBox(`${data.id}-entrance`, { width: 1.15, height: 2.15, depth: .12 }, ctx.scene); door.parent = body; door.position.set(0, -data.scale.y / 2 + 1.075, -data.scale.z / 2 - .07); door.material = ctx.materials?.getWoodMaterial() ?? body.material; door.metadata = { mapChunkId: body.metadata.mapChunkId, visualLod: 0 }; result.push(door); return result;
}
function summary(map: WorldMapData): { mapId: string; mapName: string; mapFormatVersion: number; seed: number; chunkCount: number } { return { mapId: map.mapId, mapName: map.mapName, mapFormatVersion: map.mapFormatVersion, seed: map.seed, chunkCount: map.chunks.length }; }
