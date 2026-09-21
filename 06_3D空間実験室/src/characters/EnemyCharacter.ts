import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { LinesMesh } from "@babylonjs/core/Meshes/linesMesh";
import type { Scene } from "@babylonjs/core/scene";
import { CharacterNavigation } from "../ai/CharacterNavigation";
import { DetectionSystem } from "../ai/DetectionSystem";
import type { WorldRegistry } from "../world/WorldRegistry";
import { CharacterController } from "./Character";
import type { HumanoidRig } from "./CharacterFactory";
import { CharacterStateMachine } from "./CharacterStateMachine";
import type { INavigationService } from "../contracts/ServiceContracts";

type EnemyState = "IDLE" | "PATROL" | "ALERT" | "CHASE" | "RETURN";
export type EnemyDebugState = EnemyState;

export class EnemyCharacter extends CharacterController {
  private readonly machine: CharacterStateMachine<EnemyState, EnemyCharacter>;
  private readonly navigation: CharacterNavigation;
  private readonly detection: DetectionSystem;
  private waypoint?: Vector3;
  private alertRemaining = .75;
  private lostSeconds = 0;
  private lastKnownPlayerPosition?: Vector3;
  private aiEnabled = true;
  private caughtCooldown = 0;
  private detectionDebug: LinesMesh;
  private chaseRepath = 0;
  private handledStuckCount = 0;
  private patrolRetry = 0;
  private detectionLevelValue = 0;
  private wasFullyDetected = false;
  private detectionInfoValue = { lineOfSight: false, inFov: false, distance: 0 };
  private visionDebugVisible = false;
  private detectionSuppressedUntil = 0;

  constructor(id: string, rig: HumanoidRig, areaId: string, private readonly scene: Scene, registry: WorldRegistry, seed: number, private readonly playerPosition: () => Vector3, private readonly onCaught: (id: string) => void, private readonly navMesh?: INavigationService) {
    super(id, "ENEMY", rig, areaId, 1.5, "PATROL", 15);
    this.navigation = new CharacterNavigation(registry, seed, "ENEMY", navMesh); this.detection = new DetectionSystem(scene, 180);
    this.detectionDebug = createDetectionDebug(scene, id, this.detectionRange, 105); this.detectionDebug.parent = rig.root; this.detectionDebug.isVisible = false;
    this.machine = new CharacterStateMachine<EnemyState, EnemyCharacter>("PATROL", this, {
      IDLE: { enter: (enemy) => enemy.setState("IDLE"), update: () => undefined },
      PATROL: { enter: (enemy) => { enemy.setState("PATROL"); enemy.planPatrol(); }, update: (enemy, dt) => enemy.updatePatrol(dt) },
      ALERT: { enter: (enemy) => { enemy.alertRemaining = .75; enemy.setState("ALERT"); enemy.refreshLabel(true); }, update: (enemy, dt) => { if ((enemy.alertRemaining -= dt) <= 0) enemy.machine.transition("CHASE"); } },
      CHASE: { enter: (enemy) => { enemy.setState("CHASE"); enemy.speed = 3; }, update: (enemy, dt) => enemy.updateChase(dt) },
      RETURN: { enter: (enemy) => { enemy.setState("RETURN"); enemy.speed = 1.5; enemy.navigation.plan(enemy.currentArea, enemy.homeArea, enemy.rig.root.position); enemy.updateReturnWaypoint(); }, update: (enemy, dt) => enemy.updateReturn(dt) },
    });
  }

  setAIEnabled(enabled: boolean): void { this.aiEnabled = enabled; if (!enabled) { this.machine.transition("IDLE"); this.currentTarget = "—"; } else if (this.machine.state === "IDLE") this.machine.transition("PATROL"); }
  detectionLevel(): number { return this.detectionLevelValue; }
  detectionInfo(): { level: number; lineOfSight: boolean; inFov: boolean; distance: number } { return { level: this.detectionLevelValue, ...this.detectionInfoValue }; }
  debugForceState(state: EnemyDebugState): void { this.aiEnabled = state !== "IDLE"; this.machine.transition(state); }
  debugClearDetection(): void { this.detectionLevelValue = 0; this.wasFullyDetected = false; this.lostSeconds = 5; this.detectionSuppressedUntil = performance.now() + 1200; if (this.machine.state === "CHASE" || this.machine.state === "ALERT") this.machine.transition("RETURN"); }
  debugForceDetected(): void { this.detectionLevelValue = 1; this.lastKnownPlayerPosition = this.playerPosition(); this.machine.transition("CHASE"); }
  setVisionDebugVisible(visible: boolean): void { this.visionDebugVisible = visible; this.detectionDebug.isVisible = visible; }
  override setDebugVisible(visible: boolean): void { super.setDebugVisible(visible); this.detectionDebug.isVisible = visible || this.visionDebugVisible; }

  update(deltaSeconds: number): void {
    const player = this.playerPosition(); this.caughtCooldown = Math.max(0, this.caughtCooldown - deltaSeconds);
    if (this.aiEnabled) {
      const result = this.detection.detect(this.rig.root.position, this.rig.root.rotation.y, player, this.detectionRange);
      this.detectionInfoValue = { lineOfSight: result.lineOfSight, inFov: result.inFov, distance: result.distance };
      const detectionSuppressed = performance.now() < this.detectionSuppressedUntil;
      const exposed = !detectionSuppressed && result.inFov && result.lineOfSight && result.distance <= this.detectionRange;
      const proximity = exposed ? Math.max(.15, 1 - result.distance / this.detectionRange) : 0;
      this.detectionLevelValue = Math.max(0, Math.min(1, this.detectionLevelValue + (exposed ? (.35 + proximity) * deltaSeconds : -1.15 * deltaSeconds)));
      if (this.detectionLevelValue >= 1 && !this.wasFullyDetected) { this.wasFullyDetected = true; this.onCaught(`${this.id}:detected`); }
      if (this.detectionLevelValue < .35) this.wasFullyDetected = false;
      if (result.detected && !detectionSuppressed) {
        this.lastKnownPlayerPosition = player.clone(); this.lostSeconds = 0;
        if (this.machine.state === "PATROL" || this.machine.state === "RETURN") this.machine.transition("ALERT");
      } else if (this.machine.state === "CHASE") this.lostSeconds += deltaSeconds;
      this.machine.update(deltaSeconds);
    }
    this.animate(deltaSeconds, Vector3.Distance(this.rig.root.position, player));
  }

  private planPatrol(): void {
    const destination = this.navigation.chooseDestination(this.currentArea);
    if (!destination || !this.navigation.plan(this.currentArea, destination.id, this.rig.root.position)) { this.currentTarget = "PATH_NOT_FOUND"; this.waypoint = undefined; this.patrolRetry = .8; return; }
    this.currentTarget = destination.id; this.applyNavigationPath();
  }

  private updatePatrol(deltaSeconds: number): void {
    if (this.stuckCount > this.handledStuckCount) { this.handledStuckCount = this.stuckCount; this.navigation.clear(); this.waypoint = undefined; this.patrolRetry = .6; }
    if (!this.waypoint) { this.patrolRetry -= deltaSeconds; if (this.patrolRetry <= 0) this.planPatrol(); return; }
    if (!this.moveToward(this.scene, this.waypoint, deltaSeconds, 1.5)) return;
    if (this.navigation.advance()) { this.currentArea = this.navigation.destinationId() ?? this.currentArea; this.planPatrol(); }
    else { this.waypoint = this.navigation.currentWaypoint(this.rig.root.position.y); this.showWaypoint(this.scene, this.waypoint); this.updateNavigationDebug(this.navigation.pathInfo()); }
  }

  private updateChase(deltaSeconds: number): void {
    if (this.stuckCount > this.handledStuckCount) { this.handledStuckCount = this.stuckCount; this.chaseRepath = 0; }
    const player = this.playerPosition(); this.currentTarget = "Player"; this.chaseRepath -= deltaSeconds;
    if (this.lostSeconds > 4) { this.machine.transition("RETURN"); return; }
    const target = this.lastKnownPlayerPosition ?? player;
    if (this.chaseRepath <= 0 || !this.waypoint) { this.chaseRepath = .42; this.navigation.planPosition(this.rig.root.position, target); this.applyNavigationPath(); }
    if (this.waypoint && this.moveToward(this.scene, this.waypoint, deltaSeconds, 3, 1.05)) {
      if (!this.navigation.advance()) { this.waypoint = this.navigation.currentWaypoint(this.rig.root.position.y); this.showWaypoint(this.scene, this.waypoint); }
    }
    this.updateNavigationDebug(this.navigation.pathInfo(), this.chaseRepath);
    if (Vector3.Distance(this.rig.root.position, player) < 1.35 && this.caughtCooldown <= 0) { this.caughtCooldown = 3; this.onCaught(this.id); }
  }

  private updateReturnWaypoint(): void { this.waypoint = this.navigation.currentWaypoint(this.rig.root.position.y); this.currentTarget = this.homeArea; this.showWaypoint(this.scene, this.waypoint); this.updateNavigationDebug(this.navigation.pathInfo()); this.navMesh?.showPath(this.id, [this.rig.root.position.clone(), ...this.navigation.pathPoints()]); }
  private updateReturn(deltaSeconds: number): void {
    if (!this.waypoint || !this.moveToward(this.scene, this.waypoint, deltaSeconds, 1.5)) return;
    if (this.navigation.advance()) { this.currentArea = this.homeArea; this.machine.transition("PATROL"); } else this.updateReturnWaypoint();
  }

  private applyNavigationPath(): void {
    this.waypoint = this.navigation.currentWaypoint(this.rig.root.position.y); this.showWaypoint(this.scene, this.waypoint); this.updateNavigationDebug(this.navigation.pathInfo(), this.chaseRepath);
    this.navMesh?.showPath(this.id, [this.rig.root.position.clone(), ...this.navigation.pathPoints()]);
  }
}

function createDetectionDebug(scene: Scene, id: string, range: number, fov: number): LinesMesh {
  const points: Vector3[] = [];
  const half = fov * Math.PI / 360;
  points.push(Vector3.Zero(), new Vector3(Math.sin(-half) * range, .03, Math.cos(-half) * range));
  for (let i = 0; i <= 18; i += 1) { const angle = -half + i / 18 * half * 2; points.push(new Vector3(Math.sin(angle) * range, .03, Math.cos(angle) * range)); }
  points.push(Vector3.Zero());
  const lines = MeshBuilder.CreateLines(`${id}-detection-debug`, { points }, scene); lines.color = new Color3(1, .2, .12); lines.isPickable = false; return lines;
}
