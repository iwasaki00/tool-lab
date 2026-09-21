import type { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { FrameworkContext } from "../../contracts/FrameworkContext";
import { FRAMEWORK_VERSION, MAP_FORMAT_VERSION } from "../../core/version";
import type { WorldMapData } from "../../map/WorldMapData";
import type { MovementSettings } from "../../player/movementSettings";
import type { EnvironmentPreset, VisualQuality } from "../../visual/VisualConfig";
import type {
  FrameworkApi,
  FrameworkLifecycleState,
  FrameworkState,
  MapLoadOptions,
  WorldCreateOptions,
} from "../public/FrameworkTypes";

export interface EmbeddedFrameworkApiOptions {
  context: FrameworkContext;
  restart(options?: WorldCreateOptions): Promise<void> | void;
  dispose(): void;
}

/** @internal Bridges an already composed scene to the stable public surface. */
export function createEmbeddedFrameworkApi(options: EmbeddedFrameworkApiOptions): FrameworkApi {
  const { context } = options;
  let lifecycle: FrameworkLifecycleState = "RUNNING";
  let disposed = false;
  const map = context.services.map;
  const features = ["navigation", "map", "interaction"] as const;

  const api: FrameworkApi = {
    initialize: async () => undefined,
    start: async () => undefined,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      options.dispose();
      lifecycle = "DISPOSED";
    },
    restartSession: async (worldOptions) => { await options.restart(worldOptions); },
    loadMap: async (input: unknown, loadOptions: MapLoadOptions = {}): Promise<WorldMapData> => {
      const result = await map.loadMap(input);
      if (loadOptions.autoExpansion !== undefined) map.setAutoExpansion(loadOptions.autoExpansion);
      if (loadOptions.chunkUnload !== undefined) map.setChunkUnload(loadOptions.chunkUnload);
      return result;
    },
    createProceduralMap: (seed, style) => map.createProceduralMap(seed, style),
    getWorld: () => context.services.world,
    getPlayer: () => ({
      getPosition: () => context.player.camera.position.clone(),
      setPosition: (position: Vector3) => context.player.camera.position.copyFrom(position),
      setMovementSpeeds: (settings: MovementSettings) => context.player.setMovementSpeeds(settings),
      setInputEnabled: (enabled: boolean) => context.player.setInputEnabled(enabled),
      jump: () => context.player.jump(),
    }),
    getNavigation: () => context.services.navigation,
    getInteraction: () => context.services.interaction,
    getEvents: () => ({
      on: (event, listener) => context.services.events.on(event, listener),
      emit: (event, payload) => context.services.events.emit(event, payload),
    }),
    getVisual: () => ({
      getState: () => context.services.visual.state(),
      setEnvironment: (preset: EnvironmentPreset) => context.services.visual.setEnvironmentPreset(preset),
      setQuality: (quality: VisualQuality) => context.services.visual.setQuality(quality),
    }),
    getMap: () => map,
    getFeatures: () => ({ has: (id) => features.includes(id), enabled: () => [...features] }),
    getState: (): FrameworkState => ({
      frameworkVersion: FRAMEWORK_VERSION,
      mapFormatVersion: MAP_FORMAT_VERSION,
      lifecycle,
      features: [...features],
      worldAreaCount: context.services.world.getAll().length,
      map: map.snapshot(),
    }),
  };
  return api;
}
