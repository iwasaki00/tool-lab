export type GuideTargetType = "KEY" | "CARD KEY" | "LOCKED DOOR" | "SWITCH" | "CONTROL ROOM" | "GOAL" | "NPC" | "ENEMY" | "ITEM" | "CHECKPOINT";

export interface MissionObjective {
  id: string;
  label: string;
  targetIds: string[];
  targetType: GuideTargetType;
}

export class ObjectiveManager {
  private current: MissionObjective = { id: "none", label: "", targetIds: [], targetType: "ITEM" };
  private completed = false;
  private readonly listeners = new Set<(objective: MissionObjective) => void>();

  constructor(private readonly onChange: (objective: string) => void, private readonly onComplete: () => void) {}

  set(objective: MissionObjective): void {
    if (this.completed) return;
    this.current = objective;
    this.onChange(objective.label);
    this.listeners.forEach((listener) => listener(objective));
  }

  get(): string { return this.current.label; }
  getDefinition(): MissionObjective { return this.current; }
  subscribe(listener: (objective: MissionObjective) => void): () => void {
    this.listeners.add(listener);
    listener(this.current);
    return () => this.listeners.delete(listener);
  }

  complete(): void {
    if (this.completed) return;
    this.completed = true;
    this.current = { id: "mission_complete", label: "MISSION COMPLETE", targetIds: [], targetType: "CHECKPOINT" };
    this.onChange(this.current.label);
    this.listeners.forEach((listener) => listener(this.current));
    this.onComplete();
  }
}
