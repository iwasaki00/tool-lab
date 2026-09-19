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
import type { NavigationManager } from "../navigation/NavigationManager";
import type { EnemyDebugState } from "./EnemyCharacter";

export interface CharacterManagerDebug {
  npcCount: number;
  enemyCount: number;
  selected?: CharacterDebugInfo;
  enemyAI: boolean;
  detection: number;
  detectionInfo?: { level: number; lineOfSight: boolean; inFov: boolean; distance: number };
  enemies: CharacterDebugInfo[];
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
  private navigationTest = false;
  private lastSpawnScan = 0;
  private readonly knownCharacterIds = new Set<string>();
  private paused = false;
  private timeScale = 1;
  private enemiesRemoved = false;
  private readonly enemyPlacements: GamePlacement[];

  constructor(
    private readonly ctx: ObjectContext,
    private readonly camera: Camera,
    placements: readonly GamePlacement[],
    private readonly registry: WorldRegistry,
    private readonly interactions: InteractionManager,
    private readonly objectives: ObjectiveManager,
    private readonly onMessage: (message: string) => void,
    setPlayerInputEnabled: (enabled: boolean) => void,
    private readonly navigation?: NavigationManager,
    private readonly onCaught: (id: string) => void = () => undefined,
    private readonly maxEnemies = Number.POSITIVE_INFINITY,
  ) {
    this.enemyPlacements = placements.filter((placement) => placement.kind === "ENEMY").map((placement) => ({ ...placement, position: { ...placement.position } }));
    this.dialogue = new DialogueManager((paused) => setPlayerInputEnabled(!paused));
    placements.filter((placement) => placement.kind === "NPC").forEach((placement, index) => this.createNPC(placement, index));
    placements.filter((placement) => placement.kind === "ENEMY").forEach((placement, index) => this.createEnemy(placement, index));
    this.observer = ctx.scene.onBeforeRenderObservable.add(() => this.update())!;
    this.pointerObserver = ctx.scene.onPointerObservable.add((info) => {
      if (info.type !== PointerEventTypes.POINTERPICK) return;
      if (this.navigationTest && info.pickInfo?.pickedPoint) { this.npcs[0]?.navigateTo(info.pickInfo.pickedPoint); this.onMessage("NAV TEST: テストNPCを移動します"); return; }
      if (!this.debugVisible) return;
      const id = info.pickInfo?.pickedMesh?.metadata?.characterId as string | undefined;
      if (id) this.select(id);
    })!;
  }

  setEnemyAI(enabled: boolean): void { this.enemyAI = enabled; this.enemies.forEach((enemy) => enemy.setAIEnabled(enabled)); }
  setNavigationTest(enabled: boolean): void { this.navigationTest = enabled; }
  setPaused(paused: boolean): void { this.paused = paused; }
  setTimeScale(scale: number): void { this.timeScale = Math.max(.05, Math.min(4, scale)); }
  setDebugVisible(visible: boolean): void { this.debugVisible = visible; this.characters.forEach((character) => character.setDebugVisible(visible)); }
  debugInfo(): CharacterManagerDebug { const enemy = this.selected instanceof EnemyCharacter ? this.selected : this.enemies[0]; return { npcCount: this.npcs.length, enemyCount: this.enemies.length, selected: this.selected?.debugInfo(), enemyAI: this.enemyAI, detection: Math.max(0, ...this.enemies.map((item) => item.detectionLevel())), detectionInfo: enemy?.detectionInfo(), enemies: this.enemies.map((item) => item.debugInfo()) }; }
  debugEnemy(command: "freeze" | "resume" | "remove" | "respawn" | "vision-on" | "vision-off" | "force-detected" | "clear-detection" | "to-player" | "player-near" | EnemyDebugState): void {
    const enemy = this.selected instanceof EnemyCharacter ? this.selected : this.enemies[0];
    if (command === "freeze") { this.setEnemyAI(false); return; } if (command === "resume") { this.setEnemyAI(true); return; }
    if (command === "remove") { this.removeAllEnemies(); return; }
    if (command === "respawn") { this.respawnEnemies(); return; }
    if (command === "vision-on" || command === "vision-off") { this.enemies.forEach((item) => item.setVisionDebugVisible(command === "vision-on")); return; }
    if (!enemy) return;
    if (command === "force-detected") enemy.debugForceDetected(); else if (command === "clear-detection") enemy.debugClearDetection();
    else if (command === "to-player") enemy.rig.root.position.copyFrom(this.camera.position.add(new Vector3(0, -1.05, 2.2)));
    else if (command === "player-near") this.camera.position.copyFrom(enemy.rig.root.position.add(new Vector3(0, 1.8, 2.2)));
    else enemy.debugForceState(command);
  }

  dispose(): void {
    this.dialogue.dispose(); this.ctx.scene.onBeforeRenderObservable.remove(this.observer); this.ctx.scene.onPointerObservable.remove(this.pointerObserver);
    this.unregisterInteractions.splice(0).forEach((dispose) => dispose()); this.characters.splice(0).forEach((character) => character.dispose());
  }

  private createNPC(placement: GamePlacement, index: number): void {
    if (this.knownCharacterIds.has(placement.id)) return; this.knownCharacterIds.add(placement.id);
    const rig = createHumanoid(this.ctx, placement.id, "NPC"); rig.root.position.copyFrom(toVector(placement.position));
    const npc = new NPCCharacter(placement.id, rig, placement.areaId, this.ctx.scene, this.registry, 9109 + index * 37, () => this.dialogue.isOpen(), this.navigation);
    this.characters.push(npc); this.npcs.push(npc); npc.setDebugVisible(this.debugVisible);
    this.unregisterInteractions.push(this.interactions.register({
      id: placement.id, displayName: `市民 ${index + 1}`, type: "inspect", mesh: rig.body, getActionLabel: () => "話す",
      interact: () => { npc.talk(); this.dialogue.open(this.dialogueFor(index)); },
    }));
  }

  private createEnemy(placement: GamePlacement, index: number): void {
    if (this.knownCharacterIds.has(placement.id)) return; this.knownCharacterIds.add(placement.id);
    const rig = createHumanoid(this.ctx, placement.id, "ENEMY"); rig.root.position.copyFrom(toVector(placement.position));
    const enemy = new EnemyCharacter(placement.id, rig, placement.areaId, this.ctx.scene, this.registry, 12011 + index * 53, () => this.camera.position.clone(), (id) => { this.onMessage(id.endsWith(":detected") ? "DETECTED — 敵に発見されました" : `PLAYER CAUGHT — ${id.toUpperCase()}`); this.onCaught(id); }, this.navigation);
    this.characters.push(enemy); this.enemies.push(enemy); enemy.setAIEnabled(this.enemyAI); enemy.setDebugVisible(this.debugVisible);
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
    if (this.paused) return;
    const deltaSeconds = Math.min(this.ctx.scene.getEngine().getDeltaTime() / 1000, .05) * this.timeScale;
    const player = this.camera.position;
    this.npcs.forEach((npc) => npc.update(deltaSeconds, player));
    this.enemies.forEach((enemy) => enemy.update(deltaSeconds));
    this.applySeparation();
    const now = performance.now(); if (now - this.lastSpawnScan > 1000) { this.lastSpawnScan = now; this.scanSemanticSpawns(); }
  }

  private scanSemanticSpawns(): void {
    if (this.enemiesRemoved || this.maxEnemies <= this.enemies.length) return;
    const mobile = document.body.classList.contains("is-mobile");
    const enemyLimit = Math.min(mobile ? 6 : 8, this.maxEnemies);
    this.registry.getAreasByType("ENEMY_SPAWN").filter((area) => !this.knownCharacterIds.has(area.id)).slice(0, Math.max(0, enemyLimit - this.enemies.length)).forEach((area) => {
      const areaId = area.connections[0] ?? area.id;
      this.createEnemy({ id: area.id, kind: "ENEMY", areaId, position: { x: area.position.x, y: area.position.y, z: area.position.z } }, this.enemies.length);
    });
  }

  private removeAllEnemies(): void {
    this.enemiesRemoved = true; if (this.selected instanceof EnemyCharacter) this.selected = undefined;
    this.enemies.splice(0).forEach((enemy) => { const index = this.characters.indexOf(enemy); if (index >= 0) this.characters.splice(index, 1); this.knownCharacterIds.delete(enemy.id); enemy.dispose(); this.navigation?.clearPath(enemy.id); });
  }

  private respawnEnemies(): void {
    this.removeAllEnemies(); this.enemiesRemoved = false;
    this.enemyPlacements.slice(0, Number.isFinite(this.maxEnemies) ? this.maxEnemies : undefined).forEach((placement, index) => this.createEnemy(placement, index));
    this.scanSemanticSpawns();
  }

  private applySeparation(): void {
    for (let i = 0; i < this.characters.length; i += 1) for (let j = i + 1; j < this.characters.length; j += 1) {
      const a = this.characters[i].rig.root.position; const b = this.characters[j].rig.root.position; const delta = a.subtract(b); delta.y = 0;
      const distance = delta.length(); if (distance <= .01 || distance >= .68) continue;
      const correction = delta.scale((.68 - distance) / distance * .08); a.addInPlace(correction); b.subtractInPlace(correction);
    }
  }
}

function toVector(position: { x: number; y: number; z: number }): Vector3 { return new Vector3(position.x, position.y, position.z); }
function describeArea(type: string): string {
  const labels: Record<string, string> = { STORAGE: "倉庫", OFFICE: "オフィス", CONTROL_ROOM: "制御室", PARK: "公園", PLAZA: "広場", ALLEY: "路地", CORRIDOR: "廊下", BUILDING_ENTRANCE: "建物入口", ROAD: "道路沿い" };
  return labels[type] ?? "案内マーカーの先";
}
