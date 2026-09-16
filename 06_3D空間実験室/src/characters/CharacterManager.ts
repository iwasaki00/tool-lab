import type { Camera } from "@babylonjs/core/Cameras/camera";
import { PointerEventTypes } from "@babylonjs/core/Events/pointerEvents";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Observer } from "@babylonjs/core/Misc/observable";
import type { PointerInfo } from "@babylonjs/core/Events/pointerEvents";
import type { Scene } from "@babylonjs/core/scene";
import type { ObjectContext } from "../objects/primitives";
import type { InteractionManager } from "../interaction/InteractionManager";
import type { GamePlacement } from "../gameplay/GamePlacementManager";
import type { ObjectiveManager } from "../gameplay/ObjectiveManager";
import type { WorldRegistry } from "../world/WorldRegistry";
import { DialogueManager, type DialogueSequence } from "../dialogue/DialogueManager";
import { createHumanoid } from "./CharacterFactory";
import { NPCCharacter } from "./NPCCharacter";
import { EnemyCharacter } from "./EnemyCharacter";
import type { CharacterController, CharacterDebugInfo } from "./Character";

export interface CharacterManagerDebug {
  npcCount: number;
  enemyCount: number;
  selected?: CharacterDebugInfo;
  enemyAI: boolean;
}

export class CharacterManager {
  private readonly characters: CharacterController[] = [];
  private readonly npcs: NPCCharacter[] = [];
  private readonly enemies: EnemyCharacter[] = [];
  private readonly unregisterInteractions: Array<() => void> = [];
  private readonly observer: Observer<Scene>;
  private readonly pointerObserver: Observer<PointerInfo>;
  private readonly dialogue: DialogueManager;
  private selected?: CharacterController;
  private debugVisible = false;
  private enemyAI = true;

  constructor(
    private readonly ctx: ObjectContext,
    private readonly camera: Camera,
    placements: readonly GamePlacement[],
    private readonly registry: WorldRegistry,
    private readonly interactions: InteractionManager,
    private readonly objectives: ObjectiveManager,
    private readonly onMessage: (message: string) => void,
    setPlayerInputEnabled: (enabled: boolean) => void,
  ) {
    this.dialogue = new DialogueManager((paused) => setPlayerInputEnabled(!paused));
    placements.filter((placement) => placement.kind === "NPC").forEach((placement, index) => this.createNPC(placement, index));
    placements.filter((placement) => placement.kind === "ENEMY").forEach((placement, index) => this.createEnemy(placement, index));
    this.observer = ctx.scene.onBeforeRenderObservable.add(() => this.update())!;
    this.pointerObserver = ctx.scene.onPointerObservable.add((info) => {
      if (!this.debugVisible || info.type !== PointerEventTypes.POINTERPICK) return;
      const id = info.pickInfo?.pickedMesh?.metadata?.characterId as string | undefined;
      if (id) this.select(id);
    })!;
  }

  setEnemyAI(enabled: boolean): void { this.enemyAI = enabled; this.enemies.forEach((enemy) => enemy.setAIEnabled(enabled)); }
  setDebugVisible(visible: boolean): void { this.debugVisible = visible; this.characters.forEach((character) => character.setDebugVisible(visible)); }
  debugInfo(): CharacterManagerDebug { return { npcCount: this.npcs.length, enemyCount: this.enemies.length, selected: this.selected?.debugInfo(), enemyAI: this.enemyAI }; }

  dispose(): void {
    this.dialogue.dispose(); this.ctx.scene.onBeforeRenderObservable.remove(this.observer); this.ctx.scene.onPointerObservable.remove(this.pointerObserver);
    this.unregisterInteractions.splice(0).forEach((dispose) => dispose()); this.characters.splice(0).forEach((character) => character.dispose());
  }

  private createNPC(placement: GamePlacement, index: number): void {
    const rig = createHumanoid(this.ctx, placement.id, "NPC"); rig.root.position.copyFrom(toVector(placement.position));
    const npc = new NPCCharacter(placement.id, rig, placement.areaId, this.ctx.scene, this.registry, 9109 + index * 37, () => this.dialogue.isOpen());
    this.characters.push(npc); this.npcs.push(npc);
    this.unregisterInteractions.push(this.interactions.register({
      id: placement.id, displayName: `市民 ${index + 1}`, type: "inspect", mesh: rig.body, getActionLabel: () => "話す",
      interact: () => { npc.talk(); this.dialogue.open(this.dialogueFor(index)); },
    }));
  }

  private createEnemy(placement: GamePlacement, index: number): void {
    const rig = createHumanoid(this.ctx, placement.id, "ENEMY"); rig.root.position.copyFrom(toVector(placement.position));
    const enemy = new EnemyCharacter(placement.id, rig, placement.areaId, this.ctx.scene, this.registry, 12011 + index * 53, () => this.camera.position.clone(), (id) => this.onMessage(`PLAYER DETECTED — ${id.toUpperCase()} に捕捉されました`));
    this.characters.push(enemy); this.enemies.push(enemy);
  }

  private dialogueFor(index: number): DialogueSequence {
    const objective = this.objectives.getDefinition();
    const target = objective.targetIds.map((id) => this.registry.get(id)).find(Boolean);
    const area = target?.connections.map((id) => this.registry.get(id)).find(Boolean) ?? target;
    const location = area ? describeArea(area.type) : "街の奥";
    const hint = objective.id === "mission_complete"
      ? "任務完了、お疲れさま。"
      : objective.targetType === "CARD KEY" ? `${location}でカードキーを見たよ。`
      : objective.targetType === "KEY" ? `${location}を探すと鍵が見つかるかもしれない。`
      : objective.targetType === "SWITCH" ? `スイッチは${location}にあるらしい。`
      : objective.targetType === "GOAL" ? `目的地は${location}の方向だよ。`
      : `${objective.label}なら、${location}を調べてみて。`;
    return [{ speaker: `市民 ${index + 1}`, text: "こんにちは。何か探しているの？" }, { speaker: `市民 ${index + 1}`, text: hint }];
  }

  private select(id: string): void {
    this.selected?.setSelected(false); this.selected = this.characters.find((character) => character.id === id); this.selected?.setSelected(true);
  }

  private update(): void {
    const deltaSeconds = Math.min(this.ctx.scene.getEngine().getDeltaTime() / 1000, .05);
    const player = this.camera.position;
    this.npcs.forEach((npc) => npc.update(deltaSeconds, player));
    this.enemies.forEach((enemy) => enemy.update(deltaSeconds));
  }
}

function toVector(position: { x: number; y: number; z: number }): Vector3 { return new Vector3(position.x, position.y, position.z); }
function describeArea(type: string): string {
  const labels: Record<string, string> = { STORAGE: "倉庫", OFFICE: "オフィス", CONTROL_ROOM: "制御室", PARK: "公園", PLAZA: "広場", ALLEY: "路地", CORRIDOR: "廊下", BUILDING_ENTRANCE: "建物入口", ROAD: "道路沿い" };
  return labels[type] ?? "案内マーカーの先";
}
