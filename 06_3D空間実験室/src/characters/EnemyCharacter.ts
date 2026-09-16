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

type EnemyState = "IDLE" | "PATROL" | "ALERT" | "CHASE" | "RETURN";

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

  constructor(id: string, rig: HumanoidRig, areaId: string, private readonly scene: Scene, registry: WorldRegistry, seed: number, private readonly playerPosition: () => Vector3, private readonly onCaught: (id: string) => void) {
    super(id, "ENEMY", rig, areaId, 1.5, "PATROL", 15);
    this.navigation = new CharacterNavigation(registry, seed, "ENEMY"); this.detection = new DetectionSystem(scene, 180);
    this.detectionDebug = createDetectionDebug(scene, id, this.detectionRange, 105); this.detectionDebug.parent = rig.root; this.detectionDebug.isVisible = false;
    this.machine = new CharacterStateMachine<EnemyState, EnemyCharacter>("PATROL", this, {
      IDLE: { enter: (enemy) => enemy.setState("IDLE"), update: () => undefined },
      PATROL: { enter: (enemy) => { enemy.setState("PATROL"); enemy.planPatrol(); }, update: (enemy, dt) => enemy.updatePatrol(dt) },
      ALERT: { enter: (enemy) => { enemy.alertRemaining = .75; enemy.setState("ALERT"); enemy.refreshLabel(true); }, update: (enemy, dt) => { if ((enemy.alertRemaining -= dt) <= 0) enemy.machine.transition("CHASE"); } },
      CHASE: { enter: (enemy) => { enemy.setState("CHASE"); enemy.speed = 3; }, update: (enemy, dt) => enemy.updateChase(dt) },
      RETURN: { enter: (enemy) => { enemy.setState("RETURN"); enemy.speed = 1.5; enemy.navigation.plan(enemy.currentArea, enemy.homeArea); enemy.updateReturnWaypoint(); }, update: (enemy, dt) => enemy.updateReturn(dt) },
    });
  }

  setAIEnabled(enabled: boolean): void { this.aiEnabled = enabled; if (!enabled) { this.machine.transition("IDLE"); this.currentTarget = "—"; } else if (this.machine.state === "IDLE") this.machine.transition("PATROL"); }
  override setDebugVisible(visible: boolean): void { super.setDebugVisible(visible); this.detectionDebug.isVisible = visible; }

  update(deltaSeconds: number): void {
    const player = this.playerPosition(); this.caughtCooldown = Math.max(0, this.caughtCooldown - deltaSeconds);
    if (this.aiEnabled) {
      const result = this.detection.detect(this.rig.root.position, this.rig.root.rotation.y, player, this.detectionRange);
      if (result.detected) {
        this.lastKnownPlayerPosition = player.clone(); this.lostSeconds = 0;
        if (this.machine.state === "PATROL" || this.machine.state === "RETURN") this.machine.transition("ALERT");
      } else if (this.machine.state === "CHASE") this.lostSeconds += deltaSeconds;
      this.machine.update(deltaSeconds);
    }
    this.animate(deltaSeconds, Vector3.Distance(this.rig.root.position, player));
  }

  private planPatrol(): void {
    const destination = this.navigation.chooseDestination(this.currentArea);
    if (!destination || !this.navigation.plan(this.currentArea, destination.id)) { this.currentTarget = this.currentArea; return; }
    this.currentTarget = destination.id; this.waypoint = this.navigation.currentWaypoint(this.rig.root.position.y); this.showWaypoint(this.scene, this.waypoint);
  }

  private updatePatrol(deltaSeconds: number): void {
    if (!this.waypoint) { this.planPatrol(); return; }
    if (!this.moveToward(this.scene, this.waypoint, deltaSeconds, 1.5)) return;
    if (this.navigation.advance()) { this.currentArea = this.navigation.destinationId() ?? this.currentArea; this.planPatrol(); }
    else { this.waypoint = this.navigation.currentWaypoint(this.rig.root.position.y); this.showWaypoint(this.scene, this.waypoint); }
  }

  private updateChase(deltaSeconds: number): void {
    const player = this.playerPosition(); this.currentTarget = "Player"; this.showWaypoint(this.scene, player);
    if (this.lostSeconds > 4) { this.machine.transition("RETURN"); return; }
    const target = this.lastKnownPlayerPosition ?? player;
    this.moveToward(this.scene, target, deltaSeconds, 3, 1.05);
    if (Vector3.Distance(this.rig.root.position, player) < 1.35 && this.caughtCooldown <= 0) { this.caughtCooldown = 3; this.onCaught(this.id); }
  }

  private updateReturnWaypoint(): void { this.waypoint = this.navigation.currentWaypoint(this.rig.root.position.y); this.currentTarget = this.homeArea; this.showWaypoint(this.scene, this.waypoint); }
  private updateReturn(deltaSeconds: number): void {
    if (!this.waypoint || !this.moveToward(this.scene, this.waypoint, deltaSeconds, 1.5)) return;
    if (this.navigation.advance()) { this.currentArea = this.homeArea; this.machine.transition("PATROL"); } else this.updateReturnWaypoint();
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
