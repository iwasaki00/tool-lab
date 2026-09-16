import type { Camera } from "@babylonjs/core/Cameras/camera";
import { Ray } from "@babylonjs/core/Culling/ray";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Observer } from "@babylonjs/core/Misc/observable";
import type { Scene } from "@babylonjs/core/scene";
import type { WorldArea } from "../world/SemanticTypes";
import type { WorldRegistry } from "../world/WorldRegistry";
import type { GuideTargetType, MissionObjective, ObjectiveManager } from "./ObjectiveManager";
import type { MissionStep } from "./MissionTypes";
import type { NavigationManager } from "../navigation/NavigationManager";

export type MissionGuideMode = "OFF" | "NORMAL" | "DEBUG" | "DEBUG_ALL";

export interface MissionGuideDebugInfo {
  objectiveId: string;
  targetId: string;
  targetType: GuideTargetType | "—";
  distance: number;
  heightDiff: number;
  visible: boolean;
  onScreen: boolean;
  status: "READY" | "GUIDE TARGET NOT FOUND" | "MISSION COMPLETE" | "OFF";
}

export class MissionGuideManager {
  private mode: MissionGuideMode = "DEBUG";
  private objective: MissionObjective = { id: "none", label: "", targetIds: [], targetType: "ITEM" };
  private targets: WorldArea[] = [];
  private active?: WorldArea;
  private readonly markerRoot: TransformNode;
  private readonly markerLabel: DynamicTexture;
  private readonly edge: HTMLElement | null;
  private readonly edgeArrow: HTMLElement | null;
  private readonly edgeLabel: HTMLElement | null;
  private readonly edgeDistance: HTMLElement | null;
  private readonly observer: Observer<Scene>;
  private readonly unsubscribe: () => void;
  private lastMetricUpdate = 0;
  private lastResolveAttempt = 0;
  private warnedKey = "";
  private readonly allMarkers: TransformNode[] = [];
  private readonly allTextures: DynamicTexture[] = [];
  private lastAllResolve = 0;
  private allMarkerSignature = "";
  private lastNavigationUpdate = 0;
  private navigationDistance = 0;
  private debug: MissionGuideDebugInfo = { objectiveId: "none", targetId: "—", targetType: "—", distance: 0, heightDiff: 0, visible: false, onScreen: false, status: "GUIDE TARGET NOT FOUND" };

  constructor(private readonly scene: Scene, private readonly camera: Camera, private readonly registry: WorldRegistry, objectives: ObjectiveManager, private readonly getSteps: () => MissionStep[] = () => [], private readonly navigation?: NavigationManager) {
    this.edge = document.querySelector("#mission-guide-edge");
    this.edgeArrow = document.querySelector("#mission-guide-arrow");
    this.edgeLabel = document.querySelector("#mission-guide-label");
    this.edgeDistance = document.querySelector("#mission-guide-distance");
    this.markerRoot = new TransformNode("mission-guide-root", scene);
    const arrow = MeshBuilder.CreateCylinder("mission-guide-3d-arrow", { height: 1.15, diameterTop: .72, diameterBottom: 0, tessellation: 4 }, scene);
    arrow.position.y = .35; arrow.parent = this.markerRoot; arrow.isPickable = false; arrow.renderingGroupId = 3;
    const arrowMaterial = new StandardMaterial("mission-guide-arrow-material", scene);
    arrowMaterial.diffuseColor = new Color3(.1, .92, .72); arrowMaterial.emissiveColor = new Color3(.08, .8, .62); arrowMaterial.disableLighting = true; arrowMaterial.disableDepthWrite = true; arrow.material = arrowMaterial;
    this.markerLabel = new DynamicTexture("mission-guide-label-texture", { width: 512, height: 192 }, scene, false);
    this.markerLabel.hasAlpha = true;
    const label = MeshBuilder.CreatePlane("mission-guide-billboard", { width: 3.2, height: 1.2 }, scene);
    label.position.y = 1.4; label.parent = this.markerRoot; label.billboardMode = Mesh.BILLBOARDMODE_ALL; label.isPickable = false; label.renderingGroupId = 3;
    const labelMaterial = new StandardMaterial("mission-guide-label-material", scene);
    labelMaterial.diffuseTexture = this.markerLabel; labelMaterial.opacityTexture = this.markerLabel; labelMaterial.emissiveColor = Color3.White(); labelMaterial.disableLighting = true; labelMaterial.disableDepthWrite = true; label.material = labelMaterial;
    scene.setRenderingAutoClearDepthStencil(3, true, true, true);
    this.markerRoot.setEnabled(false);
    this.unsubscribe = objectives.subscribe((objective) => this.setObjective(objective));
    this.observer = scene.onBeforeRenderObservable.add(() => this.update())!;
  }

  setMode(mode: MissionGuideMode): void {
    this.mode = mode;
    if (mode === "OFF") this.debug = { ...this.debug, status: "OFF", visible: false, onScreen: false };
    else this.resolveTargets();
    if (mode === "DEBUG_ALL") this.resolveAllMarkers(); else this.clearAllMarkers();
    this.applyVisibility();
  }
  getMode(): MissionGuideMode { return this.mode; }
  getDebugInfo(): MissionGuideDebugInfo { return this.debug; }
  dispose(): void { this.unsubscribe(); this.scene.onBeforeRenderObservable.remove(this.observer); this.markerRoot.dispose(false, true); this.markerLabel.dispose(); this.clearAllMarkers(); this.navigation?.clearPath("mission-guide"); this.hideEdge(); }

  private setObjective(objective: MissionObjective): void {
    this.objective = objective; this.warnedKey = ""; this.resolveTargets();
    if (objective.id === "mission_complete") this.debug = { ...this.debug, objectiveId: objective.id, targetId: "—", targetType: "—", status: "MISSION COMPLETE", distance: 0, heightDiff: 0, visible: false, onScreen: false };
    this.applyVisibility();
  }

  private resolveTargets(): void {
    this.targets = this.objective.targetIds.map((id) => this.registry.get(id)).filter((area): area is WorldArea => Boolean(area));
    this.active = nearest(this.targets, this.camera.position);
    if (!this.active && this.objective.targetIds.length) {
      const targetId = this.objective.targetIds[0]; const warningKey = `${this.objective.id}:${targetId}`;
      this.debug = { objectiveId: this.objective.id, targetId, targetType: this.objective.targetType, distance: 0, heightDiff: 0, visible: false, onScreen: false, status: "GUIDE TARGET NOT FOUND" };
      if (this.warnedKey !== warningKey) {
        this.warnedKey = warningKey;
        console.warn("GUIDE TARGET NOT FOUND", { objectiveId: this.objective.id, targetId, targetType: this.objective.targetType });
      }
    }
  }

  private update(): void {
    const now = performance.now();
    if (this.mode === "DEBUG_ALL" && now - this.lastAllResolve > 750) { this.lastAllResolve = now; this.resolveAllMarkers(); }
    if (!this.active && this.objective.targetIds.length && now - this.lastResolveAttempt > 250) { this.lastResolveAttempt = now; this.resolveTargets(); }
    if (this.mode === "OFF" || !this.active || this.objective.id === "mission_complete") { this.applyVisibility(); return; }
    const target = new Vector3(this.active.position.x, this.active.position.y, this.active.position.z);
    const bob = Math.sin(now * .0024) * .3;
    this.markerRoot.position.set(target.x, target.y + 2.8 + bob, target.z);
    this.markerRoot.rotation.y = now * .00045;
    if (now - this.lastMetricUpdate < 150) return;
    this.lastMetricUpdate = now;
    this.active = nearest(this.targets, this.camera.position) ?? this.active;
    const delta = target.subtract(this.camera.position); const directDistance = delta.length(); const heightDiff = target.y - this.camera.position.y;
    if (now - this.lastNavigationUpdate > 550) {
      this.lastNavigationUpdate = now; const route = this.navigation?.findPath(this.camera.position, target) ?? [];
      this.navigationDistance = route.length > 1 ? this.navigation?.pathLength(route) ?? directDistance : directDistance;
      if (this.mode === "DEBUG" || this.mode === "DEBUG_ALL") this.navigation?.showPath("mission-guide", route, new Color3(.18, .9, 1));
    }
    const distance = this.navigationDistance || directDistance;
    const onScreen = this.isOnScreen(target); const visible = this.isVisible(target, directDistance);
    this.debug = { objectiveId: this.objective.id, targetId: this.active.id, targetType: this.objective.targetType, distance, heightDiff, visible, onScreen, status: "READY" };
    this.drawBillboard(this.objective.targetType, distance, heightDiff);
    this.updateEdge(target, distance, heightDiff, onScreen);
    this.applyVisibility();
  }

  private isOnScreen(target: Vector3): boolean {
    const canvas = this.scene.getEngine().getRenderingCanvas(); if (!canvas) return false;
    const direction = target.subtract(this.camera.position).normalize();
    if (Vector3.Dot(this.camera.getForwardRay().direction, direction) <= .05) return false;
    const viewport = this.camera.viewport.toGlobal(canvas.clientWidth, canvas.clientHeight);
    const projected = Vector3.Project(target, Matrix.Identity(), this.scene.getTransformMatrix(), viewport);
    return projected.z >= 0 && projected.z <= 1 && projected.x >= 18 && projected.x <= canvas.clientWidth - 18 && projected.y >= 80 && projected.y <= canvas.clientHeight - 110;
  }

  private isVisible(target: Vector3, distance: number): boolean {
    const ray = new Ray(this.camera.position, target.subtract(this.camera.position).normalize(), distance);
    const hit = this.scene.pickWithRay(ray, (mesh) => mesh.isVisible && mesh.isPickable && !mesh.name.startsWith("mission-guide"));
    return !hit?.hit || hit.distance >= distance - 1;
  }

  private updateEdge(target: Vector3, distance: number, heightDiff: number, onScreen: boolean): void {
    if (!this.edge || !this.edgeArrow || !this.edgeLabel || !this.edgeDistance) return;
    this.edge.hidden = false; this.edge.classList.toggle("is-on-screen", onScreen);
    this.edgeLabel.textContent = this.objective.targetType;
    this.edgeDistance.textContent = `${heightGlyph(heightDiff)}${distance.toFixed(1)}m`;
    if (onScreen) { this.edge.style.left = "50%"; this.edge.style.top = "112px"; this.edgeArrow.textContent = "◆"; this.edge.style.setProperty("--guide-angle", "0deg"); return; }
    const forward = this.camera.getForwardRay().direction.clone(); forward.y = 0; forward.normalize();
    const toTarget = target.subtract(this.camera.position); toTarget.y = 0; toTarget.normalize();
    const angle = Math.atan2(Vector3.Cross(forward, toTarget).y, Vector3.Dot(forward, toTarget));
    const width = window.visualViewport?.width ?? window.innerWidth; const height = window.visualViewport?.height ?? window.innerHeight;
    const mobile = document.body.classList.contains("is-mobile");
    const x = width / 2 + Math.sin(angle) * Math.max(40, width / 2 - 58);
    const y = height / 2 - Math.cos(angle) * Math.max(60, height / 2 - (mobile ? 205 : 145));
    this.edge.style.left = `${Math.max(42, Math.min(width - 42, x))}px`;
    this.edge.style.top = `${Math.max(105, Math.min(height - (mobile ? 185 : 120), y))}px`;
    this.edgeArrow.textContent = "▲"; this.edge.style.setProperty("--guide-angle", `${angle * 180 / Math.PI}deg`);
  }

  private drawBillboard(label: string, distance: number, heightDiff: number): void {
    const context = this.markerLabel.getContext() as unknown as CanvasRenderingContext2D; context.clearRect(0, 0, 512, 192);
    context.fillStyle = "rgba(3, 18, 24, .82)"; context.fillRect(18, 12, 476, 166);
    context.strokeStyle = "#55f0c0"; context.lineWidth = 5; context.strokeRect(18, 12, 476, 166);
    context.textAlign = "center"; context.fillStyle = "#bffff0"; context.font = "bold 54px monospace"; context.fillText(label, 256, 78);
    context.fillStyle = "#ffffff"; context.font = "bold 42px monospace"; context.fillText(`${heightGlyph(heightDiff)}${distance.toFixed(1)}m`, 256, 142); this.markerLabel.update();
  }

  private applyVisibility(): void {
    const active = this.mode !== "OFF" && Boolean(this.active) && this.objective.id !== "mission_complete";
    this.markerRoot.setEnabled(active && (this.mode === "DEBUG" || this.mode === "DEBUG_ALL"));
    if (!active) this.hideEdge();
  }

  private resolveAllMarkers(): void {
    const signature = this.getSteps().map((step) => `${step.id}:${step.status}:${step.targetIds.filter((id) => this.registry.get(id)).join(",")}`).join("|");
    if (signature === this.allMarkerSignature) return;
    this.clearAllMarkers();
    this.allMarkerSignature = signature;
    this.getSteps().forEach((step, index) => step.targetIds.forEach((id) => {
      const area = this.registry.get(id); if (!area) return;
      const root = new TransformNode(`mission-guide-all-${index + 1}-${id}`, this.scene);
      root.position.set(area.position.x, area.position.y + 3.6, area.position.z);
      const marker = MeshBuilder.CreateCylinder(`mission-step-${index + 1}`, { height: .65, diameterTop: .42, diameterBottom: 0, tessellation: 4 }, this.scene);
      marker.parent = root; marker.isPickable = false; marker.renderingGroupId = 3;
      const material = new StandardMaterial(`mission-step-${index + 1}-material`, this.scene);
      const color = step.status === "COMPLETED" ? new Color3(.3, .65, .45) : step.status === "ACTIVE" ? new Color3(.1, .92, .72) : new Color3(.55, .62, .68);
      material.emissiveColor = color; material.diffuseColor = color; material.disableLighting = true; material.disableDepthWrite = true; marker.material = material;
      const texture = new DynamicTexture(`mission-step-${index + 1}-texture`, { width: 384, height: 96 }, this.scene, false); texture.hasAlpha = true;
      const context = texture.getContext() as unknown as CanvasRenderingContext2D; context.clearRect(0, 0, 384, 96); context.fillStyle = "rgba(3,18,24,.85)"; context.fillRect(4, 4, 376, 88); context.strokeStyle = "#55f0c0"; context.strokeRect(4, 4, 376, 88); context.fillStyle = "#effffb"; context.textAlign = "center"; context.font = "bold 34px monospace"; context.fillText(`[${index + 1} ${step.targetType}]`, 192, 61); texture.update();
      const label = MeshBuilder.CreatePlane(`mission-step-${index + 1}-label`, { width: 2.5, height: .63 }, this.scene); label.parent = root; label.position.y = .75; label.billboardMode = Mesh.BILLBOARDMODE_ALL; label.isPickable = false; label.renderingGroupId = 3;
      const labelMaterial = new StandardMaterial(`mission-step-${index + 1}-label-material`, this.scene); labelMaterial.diffuseTexture = texture; labelMaterial.opacityTexture = texture; labelMaterial.emissiveColor = Color3.White(); labelMaterial.disableLighting = true; labelMaterial.disableDepthWrite = true; label.material = labelMaterial;
      this.allMarkers.push(root); this.allTextures.push(texture);
    }));
  }

  private clearAllMarkers(): void {
    this.allMarkers.splice(0).forEach((marker) => marker.dispose(false, true));
    this.allTextures.splice(0).forEach((texture) => texture.dispose());
    this.allMarkerSignature = "";
  }

  private hideEdge(): void { if (this.edge) this.edge.hidden = true; }
}

function nearest(areas: WorldArea[], position: { x: number; y: number; z: number }): WorldArea | undefined {
  return areas.reduce<WorldArea | undefined>((best, area) => !best || squared(area.position, position) < squared(best.position, position) ? area : best, undefined);
}
function squared(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): number { return (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2; }
function heightGlyph(diff: number): string { return diff > 2 ? "▲ " : diff < -2 ? "▼ " : ""; }
