export type LoadingStage = "FRAMEWORK_INITIALIZING" | "WORLD_LOADING" | "FEATURES_INITIALIZING" | "GAME_COMPOSING" | "READY";
export type ApplicationErrorKind = "FRAMEWORK" | "FEATURE" | "GAME";

export class ApplicationLifecycle {
  private disposers: Array<() => void> = [];
  private currentStage: LoadingStage = "FRAMEWORK_INITIALIZING";

  constructor(private readonly onStage?: (stage: LoadingStage) => void) {}

  stage(stage: LoadingStage): void { this.currentStage = stage; this.onStage?.(stage); }
  status(): LoadingStage { return this.currentStage; }
  add(disposer: () => void): void { this.disposers.push(disposer); }
  error(kind: ApplicationErrorKind, error: unknown): void { console.error(`${kind} INITIALIZATION ERROR`, error); }

  dispose(): void {
    this.disposers.splice(0).reverse().forEach((dispose) => { try { dispose(); } catch (error) { console.warn("APPLICATION DISPOSE WARNING", error); } });
  }
}
