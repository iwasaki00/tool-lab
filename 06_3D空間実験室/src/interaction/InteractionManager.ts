import type { Camera } from "@babylonjs/core/Cameras/camera";
import type { Observer } from "@babylonjs/core/Misc/observable";
import type { Scene } from "@babylonjs/core/scene";
import type { Interactable, InteractionFocus } from "./Interactable";
import type { IInteractionService } from "../contracts/ServiceContracts";

export class InteractionManager implements IInteractionService {
  private readonly targets = new Map<number, Interactable>();
  private focused?: Interactable;
  private focusInfo?: InteractionFocus;
  private lastScan = 0;
  private readonly observer: Observer<Scene>;

  constructor(
    private readonly scene: Scene,
    private readonly camera: Camera,
    private readonly onFocus: (focus?: InteractionFocus) => void,
    private readonly maxDistance = 3,
  ) {
    this.observer = scene.onBeforeRenderObservable.add(() => this.scan())!;
  }

  register(target: Interactable): () => void {
    target.mesh.metadata = { ...target.mesh.metadata, interactable: true, interactionType: target.type, interactionId: target.id, displayName: target.displayName };
    this.targets.set(target.mesh.uniqueId, target);
    return () => {
      this.targets.delete(target.mesh.uniqueId);
      if (this.focused === target) this.setFocus(undefined);
    };
  }

  interact(): void {
    if (!this.focused || this.focused.enabled?.() === false) return;
    this.focused.interact();
    this.scan(true);
  }

  getDebugInfo(): InteractionFocus | undefined {
    return this.focusInfo;
  }

  dispose(): void {
    this.scene.onBeforeRenderObservable.remove(this.observer);
    this.targets.clear();
    this.setFocus(undefined);
  }

  private scan(force = false): void {
    const now = performance.now();
    if (!force && now - this.lastScan < 80) return;
    this.lastScan = now;
    const ray = this.camera.getForwardRay(this.maxDistance);
    const pick = this.scene.pickWithRay(ray, (mesh) => {
      const target = this.targets.get(mesh.uniqueId);
      return Boolean(target && target.enabled?.() !== false && mesh.isEnabled() && mesh.isVisible);
    });
    if (!pick?.hit || !pick.pickedMesh || (pick.distance ?? Infinity) > this.maxDistance) {
      this.setFocus(undefined);
      return;
    }
    const target = this.targets.get(pick.pickedMesh.uniqueId);
    if (!target) { this.setFocus(undefined); return; }
    const info: InteractionFocus = { id: target.id, displayName: target.displayName, type: target.type, actionLabel: target.getActionLabel(), distance: pick.distance };
    this.focused = target;
    this.focusInfo = info;
    this.onFocus(info);
  }

  private setFocus(target?: Interactable): void {
    if (!target && !this.focused) return;
    this.focused = target;
    this.focusInfo = target ? { id: target.id, displayName: target.displayName, type: target.type, actionLabel: target.getActionLabel(), distance: 0 } : undefined;
    this.onFocus(this.focusInfo);
  }
}
