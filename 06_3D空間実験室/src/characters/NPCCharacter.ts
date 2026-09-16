import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";
import { CharacterNavigation } from "../ai/CharacterNavigation";
import type { WorldRegistry } from "../world/WorldRegistry";
import { CharacterController } from "./Character";
import type { HumanoidRig } from "./CharacterFactory";
import { CharacterStateMachine } from "./CharacterStateMachine";

type NPCState = "IDLE" | "WANDER" | "TALK";

export class NPCCharacter extends CharacterController {
  private readonly machine: CharacterStateMachine<NPCState, NPCCharacter>;
  private readonly navigation: CharacterNavigation;
  private idleRemaining = 1;
  private waypoint?: Vector3;

  constructor(id: string, rig: HumanoidRig, areaId: string, private readonly scene: Scene, registry: WorldRegistry, seed: number, private readonly dialogueOpen: () => boolean) {
    super(id, "NPC", rig, areaId, 1.2, "IDLE");
    this.navigation = new CharacterNavigation(registry, seed, "NPC");
    this.machine = new CharacterStateMachine<NPCState, NPCCharacter>("IDLE", this, {
      IDLE: { enter: (npc) => { npc.idleRemaining = 1.2 + seed % 17 / 10; npc.setState("IDLE"); }, update: (npc, dt) => { if ((npc.idleRemaining -= dt) <= 0) npc.machine.transition("WANDER"); } },
      WANDER: { enter: (npc) => { npc.setState("WANDER"); npc.planWander(); }, update: (npc, dt) => npc.updateWander(dt) },
      TALK: { enter: (npc) => npc.setState("TALK"), update: (npc) => { if (!npc.dialogueOpen()) npc.machine.transition("IDLE"); } },
    });
  }

  update(deltaSeconds: number, playerPosition: Vector3): void { this.machine.update(deltaSeconds); this.animate(deltaSeconds, Vector3.Distance(this.rig.root.position, playerPosition)); }
  talk(): void { this.machine.transition("TALK"); }

  private planWander(): void {
    const destination = this.navigation.chooseDestination(this.currentArea);
    if (!destination || !this.navigation.plan(this.currentArea, destination.id)) { this.machine.transition("IDLE"); return; }
    this.currentTarget = destination.id; this.waypoint = this.navigation.currentWaypoint(this.rig.root.position.y); this.showWaypoint(this.scene, this.waypoint);
  }

  private updateWander(deltaSeconds: number): void {
    if (!this.waypoint) { this.machine.transition("IDLE"); return; }
    if (!this.moveToward(this.scene, this.waypoint, deltaSeconds)) return;
    const finished = this.navigation.advance();
    if (finished) { this.currentArea = this.navigation.destinationId() ?? this.currentArea; this.currentTarget = "—"; this.showWaypoint(this.scene); this.machine.transition("IDLE"); return; }
    this.waypoint = this.navigation.currentWaypoint(this.rig.root.position.y); this.showWaypoint(this.scene, this.waypoint);
  }
}
