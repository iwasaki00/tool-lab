import type { Scene } from "@babylonjs/core/scene";
import type { PlayerController } from "../player/createPlayer";
import type { VisualManager } from "../visual/VisualManager";
import type { EventManager } from "../gameplay/EventManager";
import type { FrameworkEventMap } from "./FrameworkEvents";
import type { IInteractionService, IMapService, INavigationService, IWorldService } from "./ServiceContracts";

export interface FrameworkServices {
  readonly world: IWorldService;
  readonly navigation: INavigationService;
  readonly map: IMapService;
  readonly interaction: IInteractionService;
  readonly events: EventManager<FrameworkEventMap>;
  readonly visual: VisualManager;
}

export interface FrameworkContext {
  readonly scene: Scene;
  readonly player: PlayerController;
  readonly services: FrameworkServices;
}
