import type { FrameworkContext } from "../contracts/FrameworkContext";
import { FRAMEWORK_EVENT } from "../contracts/FrameworkEvents";
import type { FeatureModule } from "../contracts/FeatureModule";
import type { GameplayCallbacks, LaboratoryScenario, ScenarioFactory, ScenarioPolicy } from "../contracts/ScenarioContracts";
import { WorldMapManager } from "../map/WorldMapManager";
import { NavigationManager } from "../navigation/NavigationManager";
import type { FrameworkSceneRuntime } from "../scene/FrameworkSceneBootstrap";
import type { CitySettings } from "../world/types";

export interface LaboratoryFeatureContext {
  base: FrameworkSceneRuntime;
  mobile: boolean;
  citySettings: CitySettings;
  callbacks: GameplayCallbacks;
  scenarioFactory: ScenarioFactory;
  scenarioPolicy?: ScenarioPolicy;
}

export class LaboratoryFeatureRuntime {
  readonly navigation: NavigationManager;
  readonly worldMap: WorldMapManager;
  readonly framework: FrameworkContext;
  private scenarioValue: LaboratoryScenario;

  constructor(private readonly context: LaboratoryFeatureContext) {
    const { base, citySettings, mobile } = context;
    this.navigation = new NavigationManager(base.scene, base.registry, (event) => base.events.emit(FRAMEWORK_EVENT.NAVIGATION_STATUS_CHANGED, event));
    this.scenarioValue = this.createScenario(citySettings);
    this.worldMap = new WorldMapManager(base.objectContext, base.registry, base.player.camera, citySettings.seed, citySettings.style, () => this.navigation.requestRebuild(), mobile, (event) => base.events.emit(FRAMEWORK_EVENT.MAP_STATUS_CHANGED, event));
    const runtime = this;
    this.framework = {
      scene: base.scene,
      player: base.player,
      services: {
        world: base.registry,
        navigation: this.navigation,
        map: this.worldMap,
        get interaction() { return runtime.scenario.interactionService; },
        events: base.events,
        visual: base.visuals,
      },
    };
  }

  get scenario(): LaboratoryScenario { return this.scenarioValue; }

  restartScenario(settings: CitySettings): LaboratoryScenario {
    this.scenarioValue.dispose();
    this.context.base.player.camera.position.copyFrom(this.context.base.missionSpawn);
    this.context.base.player.camera.cameraDirection.setAll(0);
    this.context.base.player.camera.cameraRotation.setAll(0);
    this.scenarioValue = this.createScenario(settings);
    return this.scenarioValue;
  }

  dispose(): void {
    this.scenarioValue.dispose();
    this.worldMap.dispose();
    this.navigation.dispose();
  }

  private createScenario(settings: CitySettings): LaboratoryScenario {
    const { base, callbacks, mobile, scenarioFactory, scenarioPolicy } = this.context;
    return scenarioFactory(
      base.objectContext, base.player.camera, base.missionSpawn.clone(), callbacks, base.registry, base.generatedCity?.interiorSites,
      settings.seed, settings.missionSeed, settings.missionType, settings.missionDifficulty, mobile,
      (enabled) => base.player.setInputEnabled(enabled), this.navigation, scenarioPolicy, base.events,
    );
  }
}

export const laboratoryFeatureInitializer: FeatureModule<LaboratoryFeatureContext, LaboratoryFeatureRuntime> = {
  id: "laboratory-optional-features",
  initialize: (context) => new LaboratoryFeatureRuntime(context),
};
