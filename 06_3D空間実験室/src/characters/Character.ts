import { Ray } from "@babylonjs/core/Culling/ray";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { Scene } from "@babylonjs/core/scene";
import type { HumanoidRig } from "./CharacterFactory";

export type CharacterType = "NPC" | "ENEMY";
export type CharacterState = "IDLE" | "WANDER" | "TALK" | "PATROL" | "ALERT" | "CHASE" | "RETURN";

export interface CharacterDebugInfo {
  id: string;
  type: CharacterType;
  state: CharacterState;
  target: string;
  area: string;
  health: number;
}

export class CharacterController {
  readonly health = 100;
  currentTarget = "—";
  currentArea: string;
  speed: number;
  state: CharacterState;
  readonly detectionRange: number;
  protected moving = false;
  private animationTime = 0;
  private debugVisible = false;
  private selected = false;
  private waypointMarker?: Mesh;

  constructor(
    readonly id: string,
    readonly type: CharacterType,
    readonly rig: HumanoidRig,
    readonly homeArea: string,
    speed: number,
    state: CharacterState,
    detectionRange = 0,
  ) {
    this.currentArea = homeArea; this.speed = speed; this.state = state; this.detectionRange = detectionRange;
  }

  setState(state: CharacterState): void { this.state = state; this.refreshLabel(); }
  setSelected(selected: boolean): void { this.selected = selected; this.refreshLabel(); }
  setDebugVisible(visible: boolean): void { this.debugVisible = visible; this.refreshLabel(); if (this.waypointMarker) this.waypointMarker.isVisible = visible; }

  moveToward(scene: Scene, target: Vector3, deltaSeconds: number, speed = this.speed, minimumDistance = .12): boolean {
    const delta = target.subtract(this.rig.root.position); delta.y = 0;
    const distance = delta.length();
    if (distance <= minimumDistance) { this.moving = false; return true; }
    const direction = delta.scale(1 / distance);
    const amount = Math.min(distance - minimumDistance, speed * deltaSeconds);
    const origin = this.rig.root.position.add(new Vector3(0, .85, 0));
    const obstruction = scene.pickWithRay(new Ray(origin, direction, amount + .42), (mesh) => mesh.checkCollisions && !mesh.metadata?.characterId && !mesh.name.includes("ground"));
    if (obstruction?.hit && (obstruction.distance ?? Infinity) < amount + .35) { this.moving = false; return false; }
    const desiredYaw = Math.atan2(direction.x, direction.z);
    this.rig.root.rotation.y += shortestAngle(this.rig.root.rotation.y, desiredYaw) * Math.min(1, deltaSeconds * 7);
    this.rig.root.position.addInPlace(direction.scale(amount));
    this.moving = true;
    return distance - amount <= minimumDistance + .02;
  }

  animate(deltaSeconds: number, playerDistance: number): void {
    this.animationTime += deltaSeconds;
    if (playerDistance > 45 && Math.floor(this.animationTime * 6) % 2) return;
    const amplitude = this.moving ? .58 : .035;
    const frequency = this.moving ? 8 : 2;
    const swing = Math.sin(this.animationTime * frequency) * amplitude;
    this.rig.armL.rotation.x = swing; this.rig.armR.rotation.x = -swing;
    this.rig.legL.rotation.x = -swing * .72; this.rig.legR.rotation.x = swing * .72;
    if (!this.moving) this.rig.body.position.y = 1.1 + Math.sin(this.animationTime * 2) * .012;
    this.moving = false;
  }

  showWaypoint(scene: Scene, target?: Vector3): void {
    if (!target) { this.waypointMarker?.setEnabled(false); return; }
    if (!this.waypointMarker) {
      this.waypointMarker = MeshBuilder.CreateSphere(`${this.id}-waypoint-debug`, { diameter: .24, segments: 6 }, scene);
      this.waypointMarker.isPickable = false; this.waypointMarker.visibility = .75;
    }
    this.waypointMarker.position.copyFrom(target); this.waypointMarker.position.y += .18; this.waypointMarker.setEnabled(true); this.waypointMarker.isVisible = this.debugVisible;
  }

  debugInfo(): CharacterDebugInfo { return { id: this.id, type: this.type, state: this.state, target: this.currentTarget, area: this.currentArea, health: this.health }; }
  dispose(): void { this.waypointMarker?.dispose(); this.rig.dispose(); }

  protected refreshLabel(alert = false): void {
    const title = alert ? "!" : this.selected ? `◆ ${this.id.toUpperCase()}` : this.type;
    this.rig.setLabel(title, this.debugVisible || this.selected ? this.state : "", alert);
  }
}

function shortestAngle(from: number, to: number): number { return Math.atan2(Math.sin(to - from), Math.cos(to - from)); }
