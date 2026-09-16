import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { LinesMesh } from "@babylonjs/core/Meshes/linesMesh";
import type { Observer } from "@babylonjs/core/Misc/observable";
import type { Scene } from "@babylonjs/core/scene";
import { RecastJSPlugin } from "@babylonjs/core/Navigation/Plugins/recastJSPlugin";
import Recast from "recast-detour";
import type { WorldRegistry } from "../world/WorldRegistry";

export type NavigationStatus = "BUILDING" | "READY" | "ERROR";
export interface NavigationStats { status: NavigationStatus; triangles: number; buildTime: number; pathFailures: number; validation: string }

export class NavigationManager {
  private plugin?: RecastJSPlugin;
  private debugMesh?: Mesh;
  private readonly debugPaths = new Map<string, LinesMesh>();
  private status: NavigationStatus = "BUILDING";
  private triangles = 0;
  private buildTime = 0;
  private pathFailures = 0;
  private validation = "PENDING";
  private debugVisible = false;
  private rebuilding = false;
  private rebuildRequested = false;
  private lastSignature = "";
  private lastSignatureCheck = 0;
  private readonly observer: Observer<Scene>;

  constructor(private readonly scene: Scene, private readonly registry: WorldRegistry) {
    this.observer = scene.onBeforeRenderObservable.add(() => this.monitorGeometry())!;
    void this.initialize();
  }

  isReady(): boolean { return this.status === "READY" && Boolean(this.plugin); }
  stats(): NavigationStats { return { status: this.status, triangles: this.triangles, buildTime: this.buildTime, pathFailures: this.pathFailures, validation: this.validation }; }

  requestRebuild(): void {
    this.rebuildRequested = true;
    if (!this.rebuilding && this.plugin) window.setTimeout(() => void this.build(), 80);
  }

  findPath(start: Vector3, goal: Vector3): Vector3[] {
    if (!this.plugin || this.status !== "READY") return [];
    try {
      const from = this.plugin.getClosestPoint(start); const to = this.plugin.getClosestPoint(goal);
      const path = this.plugin.computePathSmooth(from, to).map((point) => point.clone());
      if (path.length < 2) this.pathFailures += 1;
      return simplify(path);
    } catch (error) {
      this.pathFailures += 1; console.warn("NAVIGATION PATH_NOT_FOUND", { start, goal, error }); return [];
    }
  }

  closestPoint(position: Vector3): Vector3 { return this.plugin && this.status === "READY" ? this.plugin.getClosestPoint(position) : position.clone(); }
  randomPoint(position: Vector3, radius: number): Vector3 { return this.plugin && this.status === "READY" ? this.plugin.getRandomPointAround(this.closestPoint(position), radius) : position.clone(); }
  pathLength(path: Vector3[]): number { let total = 0; for (let i = 1; i < path.length; i += 1) total += Vector3.Distance(path[i - 1], path[i]); return total; }

  showPath(id: string, path: Vector3[], color = new Color3(.2, 1, .72)): void {
    this.debugPaths.get(id)?.dispose(); this.debugPaths.delete(id);
    if (path.length < 2) return;
    const points = path.map((point) => point.add(new Vector3(0, .14, 0)));
    const line = MeshBuilder.CreateLines(`navigation-path-${id}`, { points, updatable: false }, this.scene); line.color = color; line.isPickable = false; line.isVisible = this.debugVisible;
    this.debugPaths.set(id, line);
  }

  clearPath(id: string): void { this.debugPaths.get(id)?.dispose(); this.debugPaths.delete(id); }
  setDebugVisible(visible: boolean): void { this.debugVisible = visible; if (this.debugMesh) this.debugMesh.isVisible = visible; this.debugPaths.forEach((path) => { path.isVisible = visible; }); }

  validate(points: Array<{ id: string; position: Vector3 }>): void {
    if (!this.isReady() || points.length < 2) { this.validation = "PENDING"; return; }
    const origin = points[0]; const failures = points.slice(1).filter((point) => this.findPath(origin.position, point.position).length < 2).map((point) => point.id);
    this.validation = failures.length ? `WARN: ${failures.join(", ")}` : "PASS";
    if (failures.length) console.warn("NAVIGATION VALIDATION", { origin: origin.id, unreachable: failures });
  }

  dispose(): void {
    this.scene.onBeforeRenderObservable.remove(this.observer); this.debugMesh?.dispose(); this.debugPaths.forEach((path) => path.dispose()); this.debugPaths.clear(); this.plugin?.dispose();
  }

  private async initialize(): Promise<void> {
    try {
      this.setLoading(true); const recast = await Recast(); this.plugin = new RecastJSPlugin(recast); this.plugin.setDefaultQueryExtent(new Vector3(3, 6, 3)); await this.build();
    } catch (error) {
      this.status = "ERROR"; this.setLoading(false); console.error("NAVIGATION INITIALIZE ERROR", error);
    }
  }

  private async build(): Promise<void> {
    if (!this.plugin || this.rebuilding) { this.rebuildRequested = true; return; }
    this.rebuilding = true; this.rebuildRequested = false; this.status = "BUILDING"; this.setLoading(true);
    await new Promise<void>((resolve) => requestAnimationFrame(() => window.setTimeout(resolve, 0)));
    const started = performance.now();
    try {
      const meshes = this.navigationMeshes();
      this.plugin.createNavMesh(meshes, {
        cs: .32, ch: .18, walkableSlopeAngle: 48, walkableHeight: 9, walkableClimb: 3, walkableRadius: 2,
        maxEdgeLen: 24, maxSimplificationError: 1.3, minRegionArea: 8, mergeRegionArea: 20,
        maxVertsPerPoly: 6, detailSampleDist: 6, detailSampleMaxError: 1, tileSize: 24,
      });
      this.debugMesh?.dispose(false, true); this.debugMesh = this.plugin.createDebugNavMesh(this.scene); this.debugMesh.name = "navigation-debug-mesh"; this.debugMesh.isPickable = false;
      const material = new StandardMaterial("navigation-debug-material", this.scene); material.diffuseColor = new Color3(.05, .72, .54); material.emissiveColor = new Color3(.03, .28, .2); material.alpha = .34; material.wireframe = true; this.debugMesh.material = material; this.debugMesh.isVisible = this.debugVisible;
      this.triangles = Math.floor(this.debugMesh.getTotalIndices() / 3); this.buildTime = performance.now() - started; this.status = "READY"; this.lastSignature = this.geometrySignature();
      const candidates = [
        ...["start_area", "park_main", "plaza_main"].map((id) => this.registry.get(id)),
        ...this.registry.getAreasByType("BUILDING_ENTRANCE").slice(0, 2),
        ...this.registry.getAreasByType("ITEM").slice(0, 3),
        ...this.registry.getAreasByType("GOAL_AREA").slice(0, 1),
        ...this.registry.getAreasByType("CONTROL_ROOM").slice(0, 1),
      ].filter((area, index, values) => Boolean(area) && values.findIndex((candidate) => candidate?.id === area?.id) === index);
      if (candidates.length > 1) this.validate(candidates.map((area) => ({ id: area!.id, position: new Vector3(area!.position.x, area!.position.y, area!.position.z) })));
    } catch (error) {
      this.status = "ERROR"; console.error("NAVMESH BUILD ERROR", error);
    } finally {
      this.rebuilding = false; this.setLoading(false); if (this.rebuildRequested) window.setTimeout(() => void this.build(), 120);
    }
  }

  private navigationMeshes(): Mesh[] {
    return this.scene.meshes.filter((mesh): mesh is Mesh => {
      if (!mesh.checkCollisions || mesh.isDisposed() || mesh.getTotalVertices() <= 0) return false;
      if (mesh.metadata?.characterId || mesh.metadata?.navigationDoorOpen) return false;
      return !/debug|guide|marker|item|label|switch|button/i.test(mesh.name);
    });
  }

  private geometrySignature(): string {
    return this.navigationMeshes().map((mesh) => `${mesh.uniqueId}:${mesh.getTotalVertices()}:${mesh.metadata?.navigationDoorOpen ? 1 : 0}`).join("|");
  }

  private monitorGeometry(): void {
    const now = performance.now(); if (now - this.lastSignatureCheck < 900 || this.status !== "READY") return; this.lastSignatureCheck = now;
    const signature = this.geometrySignature(); if (signature !== this.lastSignature) this.requestRebuild();
  }

  private setLoading(visible: boolean): void { document.querySelector("#navigation-loading")?.classList.toggle("is-visible", visible); }
}

function simplify(path: Vector3[]): Vector3[] {
  if (path.length < 3) return path;
  const result = [path[0]];
  for (let i = 1; i < path.length - 1; i += 1) {
    const a = path[i].subtract(result[result.length - 1]).normalize(); const b = path[i + 1].subtract(path[i]).normalize();
    if (Vector3.Dot(a, b) < .995) result.push(path[i]);
  }
  result.push(path[path.length - 1]); return result;
}
