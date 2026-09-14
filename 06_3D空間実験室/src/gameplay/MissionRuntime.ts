import type { Camera } from "@babylonjs/core/Cameras/camera";
import type { Observer } from "@babylonjs/core/Misc/observable";
import type { Scene } from "@babylonjs/core/scene";
import type { WorldRegistry } from "../world/WorldRegistry";
import type { ObjectiveManager } from "./ObjectiveManager";
import type { MissionPlan, MissionResult, MissionRuntimeSnapshot, MissionStep } from "./MissionTypes";

export class MissionRuntime {
  private readonly startedAt = performance.now();
  private readonly logs = [{ elapsedSeconds: 0, message: "Mission Start" }];
  private result?: MissionResult;
  private observer?: Observer<Scene>;
  private lastPositionCheck = 0;

  constructor(
    private readonly plan: MissionPlan,
    private readonly objectives: ObjectiveManager,
    private readonly onChange: (snapshot: MissionRuntimeSnapshot) => void,
  ) {
    this.activateAvailable();
  }

  attachPositionTracking(scene: Scene, camera: Camera, registry: WorldRegistry): void {
    this.observer = scene.onBeforeRenderObservable.add(() => {
      const now = performance.now(); if (now - this.lastPositionCheck < 250 || this.result) return; this.lastPositionCheck = now;
      const step = this.current(); if (!step || (step.type !== "VISIT" && step.type !== "OPEN_DOOR")) return;
      const reached = step.targetIds.some((id) => { const area = registry.get(id); if (!area) return false; return Math.hypot(area.position.x - camera.position.x, area.position.y - camera.position.y, area.position.z - camera.position.z) < (step.type === "VISIT" ? 3.2 : 2.1); });
      if (reached && step.type === "VISIT") this.complete(step.id, `Reached ${step.description}`);
    })!;
  }

  completeByTarget(targetId: string, message?: string): boolean {
    const step = this.plan.steps.find((candidate) => candidate.status === "ACTIVE" && candidate.targetIds.includes(targetId));
    return step ? this.complete(step.id, message) : false;
  }

  complete(stepId: string, message?: string): boolean {
    const step = this.plan.steps.find((candidate) => candidate.id === stepId);
    if (!step || step.status !== "ACTIVE" || this.result) return false;
    step.status = "COMPLETED";
    this.log(message ?? step.description);
    this.activateAvailable();
    const required = this.plan.steps.filter((candidate) => !candidate.optional);
    if (required.every((candidate) => candidate.status === "COMPLETED")) this.finish();
    else this.publish();
    return true;
  }

  isTargetActive(targetId: string): boolean { return this.plan.steps.some((step) => step.status === "ACTIVE" && step.targetIds.includes(targetId)); }
  isStepComplete(stepId: string): boolean { return this.plan.steps.some((step) => step.id === stepId && step.status === "COMPLETED"); }
  current(): MissionStep | undefined { return this.plan.steps.find((step) => step.status === "ACTIVE" && !step.optional) ?? this.plan.steps.find((step) => step.status === "ACTIVE"); }
  snapshot(): MissionRuntimeSnapshot {
    const required = this.plan.steps.filter((step) => !step.optional);
    return { plan: this.plan, current: this.current(), completed: required.filter((step) => step.status === "COMPLETED").length, total: required.length, logs: [...this.logs], elapsedSeconds: this.elapsed(), complete: Boolean(this.result), result: this.result };
  }
  dispose(scene: Scene): void { if (this.observer) scene.onBeforeRenderObservable.remove(this.observer); }

  private activateAvailable(): void {
    for (const step of this.plan.steps) {
      if (step.status !== "LOCKED") continue;
      const values = step.prerequisites.stepIds.map((id) => this.plan.steps.some((candidate) => candidate.id === id && candidate.status === "COMPLETED"));
      const ready = !values.length || (step.prerequisites.mode === "AND" ? values.every(Boolean) : values.some(Boolean));
      if (ready) step.status = "ACTIVE";
    }
    const current = this.current();
    if (current) this.objectives.set({ id: current.id, label: current.description, targetIds: current.targetIds, targetType: current.targetType });
  }

  private finish(): void {
    const optional = this.plan.steps.filter((step) => step.optional);
    this.result = { type: this.plan.type, difficulty: this.plan.difficulty, clearTimeSeconds: this.elapsed(), completedSteps: this.plan.steps.filter((step) => step.status === "COMPLETED").length, totalSteps: this.plan.steps.length, optionalCompleted: optional.filter((step) => step.status === "COMPLETED").length, optionalTotal: optional.length, seed: this.plan.seed };
    this.log("Mission Complete"); this.objectives.complete(); this.publish();
  }

  private elapsed(): number { return (performance.now() - this.startedAt) / 1000; }
  private log(message: string): void { this.logs.push({ elapsedSeconds: this.elapsed(), message }); }
  private publish(): void { this.onChange(this.snapshot()); }
}
