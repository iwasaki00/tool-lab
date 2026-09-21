import type { ObjectContext } from "../objects/primitives";
import type { AreaTag, AreaType, WorldArea, WorldPosition } from "../world/SemanticTypes";
import type { WorldRegistry } from "../world/WorldRegistry";
import type { IEventService, IInteractionService, IInventoryService } from "../contracts/ServiceContracts";
import type { IMissionProgressService } from "../contracts/MissionContracts";

export type InteriorPlacementKind = "START" | "KEY" | "CARD_KEY" | "ITEM" | "ENEMY" | "NPC" | "GOAL";
export interface InteriorPlacement { id: string; kind: InteriorPlacementKind; areaId: string; position: WorldPosition }

export interface InteriorPlacementService {
  chooseArea(types: AreaType[], preferredTags?: AreaTag[], farFrom?: WorldPosition, minimumDistance?: number, buildingId?: string): WorldArea | undefined;
  place(id: string, kind: InteriorPlacementKind, area: WorldArea, y?: number): InteriorPlacement;
  registerSpawn(placement: InteriorPlacement): void;
  createDebugMarkers(ctx: ObjectContext): void;
}

export interface InteriorMissionContent {
  entranceCredential?: string;
  interior: { itemIds: string[]; switchIds: string[]; controlDoorCredential?: string };
}

export interface InteriorServices {
  interactions: IInteractionService;
  inventory: IInventoryService;
  events: IEventService;
  onMessage: (message: string) => void;
  gateEventId: string;
  registry: WorldRegistry;
  placement: InteriorPlacementService;
  missionContent: InteriorMissionContent;
  missionProgress: IMissionProgressService;
  onDoorStateChanged?: (state: { doorId: string; open: boolean; locked: boolean }) => void;
  onSwitchStateChanged?: (state: { switchId: string; active: boolean }) => void;
  onNavigationChanged?: () => void;
}
