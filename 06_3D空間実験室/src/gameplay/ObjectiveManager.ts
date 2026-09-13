export class ObjectiveManager {
  private current = "";
  private completed = false;
  constructor(private readonly onChange: (objective: string) => void, private readonly onComplete: () => void) {}

  set(objective: string): void { if (this.completed) return; this.current = objective; this.onChange(objective); }
  get(): string { return this.current; }
  complete(): void { if (this.completed) return; this.completed = true; this.current = "MISSION COMPLETE"; this.onChange(this.current); this.onComplete(); }
}
