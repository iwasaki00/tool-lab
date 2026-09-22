import type { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { bootstrapFramework, type FrameworkRuntime } from "../../bootstrap/FrameworkBootstrap";
import { DEFAULT_FRAMEWORK_CONFIG, type FrameworkConfig } from "../../bootstrap/FrameworkConfig";
import { FRAMEWORK_EVENT } from "../../contracts/FrameworkEvents";
import type { IInteractionService, IMapService, INavigationService, IWorldService } from "../../contracts/ServiceContracts";
import { FRAMEWORK_VERSION, MAP_FORMAT_VERSION } from "../../core/version";
import { InteractionManager } from "../../interaction/InteractionManager";
import { WorldMapManager } from "../../map/WorldMapManager";
import type { WorldMapData } from "../../map/WorldMapData";
import { NavigationManager } from "../../navigation/NavigationManager";
import type { MovementSettings } from "../../player/movementSettings";
import { createFrameworkScene, type FrameworkSceneRuntime } from "../../scene/FrameworkSceneBootstrap";
import type { EnvironmentPreset, VisualQuality, VisualState } from "../../visual/VisualConfig";
import { DEFAULT_CITY_SETTINGS, type CitySettings } from "../../world/types";
import type {
  CreateFrameworkOptions,
  FrameworkApi,
  FrameworkEventApi,
  FrameworkFeatureAccess,
  FrameworkLifecycleState,
  FrameworkPlayerApi,
  FrameworkState,
  FrameworkVisualApi,
  MapLoadOptions,
  WorldCreateOptions,
} from "../public/FrameworkTypes";
import { FeatureRegistry } from "../public/FeatureRegistry";

/** @internal Public consumers create this through createFramework(). */
export class DefaultFrameworkFacade implements FrameworkApi {
  private lifecycle: FrameworkLifecycleState = "CREATED";
  private error = "";
  private renderer?: FrameworkRuntime;
  private sceneRuntime?: FrameworkSceneRuntime;
  private navigation?: NavigationManager;
  private map?: WorldMapManager;
  private interaction?: InteractionManager;
  private rendering = false;
  private readonly config: FrameworkConfig;
  private readonly citySettings: CitySettings;
  private readonly features: FeatureRegistry;
  private readonly mobile: boolean;
  private readonly resize = () => this.renderer?.resize();

  constructor(private readonly options: CreateFrameworkOptions) {
    this.config = mergeConfig(options.config);
    this.citySettings = { ...DEFAULT_CITY_SETTINGS, ...options.world?.city };
    this.mobile = options.mobile ?? (matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0);
    this.features = new FeatureRegistry(options.profile ?? "FULL", options.features);
  }

  async initialize(): Promise<void> {
    if (this.lifecycle === "RUNNING" || this.lifecycle === "INITIALIZING") return;
    if (this.lifecycle === "DISPOSED") throw new Error("FRAMEWORK INSTANCE DISPOSED");
    this.lifecycle = "INITIALIZING";
    try {
      const canvas = resolveCanvas(this.options.canvas);
      this.renderer = bootstrapFramework(canvas, this.mobile, this.config);
      this.sceneRuntime = createFrameworkScene({
        engine: this.renderer.engine,
        canvas,
        mobile: this.mobile,
        worldMode: this.options.world?.mode ?? "city",
        citySettings: this.citySettings,
      });
      const base = this.sceneRuntime;
      if (this.hasFeature("navigation")) {
        this.navigation = new NavigationManager(base.scene, base.registry, (event) => base.events.emit(FRAMEWORK_EVENT.NAVIGATION_STATUS_CHANGED, event));
      }
      if (this.hasFeature("worldMap")) {
        this.map = new WorldMapManager(
          base.objectContext,
          base.registry,
          base.player.camera,
          this.citySettings.seed,
          this.citySettings.style,
          () => this.navigation?.requestRebuild(),
          this.mobile,
          (event) => base.events.emit(FRAMEWORK_EVENT.MAP_STATUS_CHANGED, event),
        );
        const streaming = this.hasFeature("chunkStreaming");
        this.map.setAutoExpansion(streaming && this.config.map.autoExpansion);
        this.map.setChunkUnload(streaming && this.config.map.chunkUnload);
      }
      if (this.hasFeature("interaction")) this.interaction = new InteractionManager(base.scene, base.player.camera, () => undefined);
      base.visuals.setQuality(this.config.visual.quality);
      window.addEventListener("resize", this.resize);
      window.addEventListener("orientationchange", this.resize);
      window.visualViewport?.addEventListener("resize", this.resize);
      this.lifecycle = "RUNNING";
    } catch (cause) {
      this.error = cause instanceof Error ? cause.message : String(cause);
      this.lifecycle = "ERROR";
      this.disposeResources();
      throw cause;
    }
  }

  async start(): Promise<void> {
    await this.initialize();
    if (this.rendering) return;
    const base = this.requireScene();
    this.renderer?.engine.runRenderLoop(() => base.scene.render());
    this.rendering = true;
  }

  dispose(): void {
    if (this.lifecycle === "DISPOSED") return;
    this.disposeResources();
    this.lifecycle = "DISPOSED";
  }

  async restartSession(options: WorldCreateOptions = {}): Promise<void> {
    const base = this.requireScene();
    base.player.camera.position.copyFrom(base.missionSpawn);
    if (this.map && options.city) {
      const settings = { ...this.citySettings, ...options.city };
      this.map.createProceduralMap(settings.seed, settings.style);
    }
  }

  async loadMap(input: unknown, options: MapLoadOptions = {}): Promise<WorldMapData> {
    const map = this.requireMap();
    const result = await map.loadMap(input);
    if (options.autoExpansion !== undefined) map.setAutoExpansion(options.autoExpansion);
    if (options.chunkUnload !== undefined) map.setChunkUnload(options.chunkUnload);
    return result;
  }

  createProceduralMap(seed?: number, style?: string): WorldMapData { return this.requireMap().createProceduralMap(seed, style); }
  getWorld(): IWorldService { return this.requireScene().registry; }
  getNavigation(): INavigationService | undefined { return this.navigation; }
  getInteraction(): IInteractionService | undefined { return this.interaction; }
  getMap(): IMapService | undefined { return this.map; }

  getPlayer(): FrameworkPlayerApi {
    const player = this.requireScene().player;
    return {
      getPosition: () => player.camera.position.clone(),
      setPosition: (position: Vector3) => player.camera.position.copyFrom(position),
      setMovementSpeeds: (settings: MovementSettings) => player.setMovementSpeeds(settings),
      setInputEnabled: (enabled: boolean) => player.setInputEnabled(enabled),
      setMoveInput: (x, y) => player.setMoveInput(x, y),
      setSprinting: (active) => player.setSprinting(active),
      rotate: (deltaX, deltaY) => player.rotate(deltaX, deltaY),
      jump: () => player.jump(),
    };
  }

  getEvents(): FrameworkEventApi {
    const events = this.requireScene().events;
    return {
      on: (event, listener) => events.on(event, listener),
      emit: (event, payload) => events.emit(event, payload),
    };
  }

  getVisual(): FrameworkVisualApi {
    const visual = this.requireScene().visuals;
    return {
      getState: (): VisualState => visual.state(),
      setEnvironment: (preset: EnvironmentPreset) => visual.setEnvironmentPreset(preset),
      setQuality: (quality: VisualQuality) => visual.setQuality(quality),
    };
  }

  getFeatures(): FrameworkFeatureAccess {
    return this.features;
  }

  getState(): FrameworkState {
    return {
      frameworkVersion: FRAMEWORK_VERSION,
      mapFormatVersion: MAP_FORMAT_VERSION,
      lifecycle: this.lifecycle,
      features: this.features.enabled(),
      worldAreaCount: this.sceneRuntime?.registry.getAll().length ?? 0,
      map: this.map?.snapshot(),
      error: this.error || undefined,
    };
  }

  private hasFeature(id: Parameters<FeatureRegistry["has"]>[0]): boolean { return this.features.has(id); }
  private requireScene(): FrameworkSceneRuntime { if (!this.sceneRuntime) throw new Error("FRAMEWORK NOT INITIALIZED"); return this.sceneRuntime; }
  private requireMap(): WorldMapManager { if (!this.map) throw new Error("MAP FEATURE NOT ENABLED"); return this.map; }

  private disposeResources(): void {
    window.removeEventListener("resize", this.resize);
    window.removeEventListener("orientationchange", this.resize);
    window.visualViewport?.removeEventListener("resize", this.resize);
    this.renderer?.engine.stopRenderLoop();
    this.rendering = false;
    this.interaction?.dispose();
    this.map?.dispose();
    this.navigation?.dispose();
    this.sceneRuntime?.dispose();
    this.sceneRuntime?.scene.dispose();
    this.renderer?.dispose();
    this.interaction = undefined;
    this.map = undefined;
    this.navigation = undefined;
    this.sceneRuntime = undefined;
    this.renderer = undefined;
  }
}

function resolveCanvas(value: HTMLCanvasElement | string): HTMLCanvasElement {
  if (value instanceof HTMLCanvasElement) return value;
  const canvas = document.querySelector<HTMLCanvasElement>(value);
  if (!canvas) throw new Error(`FRAMEWORK CANVAS NOT FOUND: ${value}`);
  return canvas;
}

function mergeConfig(config: Partial<FrameworkConfig> = {}): FrameworkConfig {
  return {
    renderer: { ...DEFAULT_FRAMEWORK_CONFIG.renderer, ...config.renderer },
    visual: { ...DEFAULT_FRAMEWORK_CONFIG.visual, ...config.visual },
    map: { ...DEFAULT_FRAMEWORK_CONFIG.map, ...config.map },
    performance: { ...DEFAULT_FRAMEWORK_CONFIG.performance, ...config.performance },
    debug: { ...DEFAULT_FRAMEWORK_CONFIG.debug, ...config.debug },
  };
}
