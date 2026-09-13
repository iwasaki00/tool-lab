import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";

export type InteractionType = "inspect" | "open" | "close" | "push" | "pickup" | "use" | "activate";

export interface Interactable {
  id: string;
  displayName: string;
  type: InteractionType;
  mesh: AbstractMesh;
  getActionLabel: () => string;
  interact: () => void;
  enabled?: () => boolean;
}

export interface InteractionFocus {
  id: string;
  displayName: string;
  type: InteractionType;
  actionLabel: string;
  distance: number;
}
