import { createDebugPanel, type DebugPanelActions } from "./debug/DebugPanel";
import { installTestBridge, type TestBridgeOptions } from "./testing/TestBridge";

export class DevComposition {
  private readonly disposers: Array<() => void> = [];

  createDebug(actions: DebugPanelActions): ReturnType<typeof createDebugPanel> {
    return createDebugPanel(actions);
  }

  installTestBridge(options: TestBridgeOptions): void {
    this.disposers.push(installTestBridge(options));
  }

  dispose(): void { this.disposers.splice(0).reverse().forEach((dispose) => dispose()); }
}
