export type UiLayer = "FRAMEWORK" | "FEATURE" | "GAME" | "DEV";

export interface UiRegistration {
  id: string;
  layer: UiLayer;
  selector: string;
  dispose?: () => void;
}

/** Registry for the existing static DOM. Phase 4 may replace registrations with lazy mounts. */
export class UiRegistry {
  private readonly registrations = new Map<string, UiRegistration>();

  register(registration: UiRegistration): this {
    if (this.registrations.has(registration.id)) throw new Error(`UI ALREADY REGISTERED: ${registration.id}`);
    this.registrations.set(registration.id, registration);
    return this;
  }

  get(id: string): UiRegistration | undefined { return this.registrations.get(id); }
  byLayer(layer: UiLayer): UiRegistration[] { return [...this.registrations.values()].filter((item) => item.layer === layer); }
  element(id: string): HTMLElement | null { const registration = this.get(id); return registration ? document.querySelector<HTMLElement>(registration.selector) : null; }

  dispose(): void {
    [...this.registrations.values()].reverse().forEach((item) => item.dispose?.());
    this.registrations.clear();
  }
}

export function registerFrameworkUi(registry: UiRegistry): void {
  registry
    .register({ id: "framework-loading", layer: "FRAMEWORK", selector: "#game-loading-screen" })
    .register({ id: "framework-error", layer: "FRAMEWORK", selector: "#error-panel" })
    .register({ id: "framework-pause", layer: "FRAMEWORK", selector: "#pause-screen" })
    .register({ id: "framework-settings", layer: "FRAMEWORK", selector: "#control-panel" })
    .register({ id: "feature-inventory", layer: "FEATURE", selector: "#inventory-panel" })
    .register({ id: "feature-mission-guide", layer: "FEATURE", selector: "#mission-guide-edge" })
    .register({ id: "dev-debug", layer: "DEV", selector: "#debug-test-panel" });
}
