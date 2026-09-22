import type { CanonicalFeatureId, FeatureId, FeatureProfile, FrameworkFeatureAccess, FrameworkFeatureOptions } from "./FrameworkTypes";

const FEATURE_IDS: CanonicalFeatureId[] = [
  "worldMap", "chunkStreaming", "interiors", "navigation", "interaction",
  "missions", "inventory", "npc", "enemies", "dialogue", "missionGuide",
  "dayNight", "vegetation", "debugTools",
];

const PROFILES: Record<FeatureProfile, Record<CanonicalFeatureId, boolean>> = {
  MINIMAL: {
    worldMap: true, chunkStreaming: true, interiors: false, navigation: false, interaction: true,
    missions: false, inventory: false, npc: false, enemies: false, dialogue: false,
    missionGuide: false, dayNight: true, vegetation: false, debugTools: false,
  },
  EXPLORATION: {
    worldMap: true, chunkStreaming: true, interiors: true, navigation: true, interaction: true,
    missions: false, inventory: false, npc: false, enemies: false, dialogue: false,
    missionGuide: false, dayNight: true, vegetation: true, debugTools: false,
  },
  FULL: {
    worldMap: true, chunkStreaming: true, interiors: true, navigation: true, interaction: true,
    missions: true, inventory: true, npc: true, enemies: true, dialogue: true,
    missionGuide: true, dayNight: true, vegetation: true, debugTools: true,
  },
};

const DEPENDENCIES: Partial<Record<CanonicalFeatureId, CanonicalFeatureId>> = {
  chunkStreaming: "worldMap",
  interiors: "worldMap",
  missionGuide: "missions",
};

export class FeatureRegistry implements FrameworkFeatureAccess {
  private readonly states: Record<CanonicalFeatureId, boolean>;
  private readonly reasons = new Map<CanonicalFeatureId, string>();

  constructor(readonly profile: FeatureProfile = "FULL", overrides: FrameworkFeatureOptions = {}, warn: (message: string) => void = console.warn) {
    this.states = { ...PROFILES[profile] };
    if (overrides.map !== undefined) this.states.worldMap = overrides.map;
    FEATURE_IDS.forEach((id) => { if (overrides[id] !== undefined) this.states[id] = overrides[id]; });
    Object.entries(DEPENDENCIES).forEach(([feature, dependency]) => {
      const id = feature as CanonicalFeatureId;
      if (!this.states[id] || this.states[dependency]) return;
      this.states[id] = false;
      const reason = `${id} requires ${dependency}; ${id} was disabled.`;
      this.reasons.set(id, reason);
      warn(`[FRAMEWORK FEATURE] ${reason}`);
    });
  }

  has(id: FeatureId): boolean { return this.isEnabled(id); }
  isEnabled(id: FeatureId): boolean { return this.states[canonical(id)]; }
  enabled(): FeatureId[] { return this.withMapAlias(FEATURE_IDS.filter((id) => this.states[id])); }
  disabled(): FeatureId[] { return this.withMapAlias(FEATURE_IDS.filter((id) => !this.states[id])); }
  reason(id: FeatureId): string | undefined { return this.reasons.get(canonical(id)); }

  private withMapAlias(ids: CanonicalFeatureId[]): FeatureId[] {
    const result: FeatureId[] = [...ids];
    if (ids.includes("worldMap")) result.splice(result.indexOf("worldMap") + 1, 0, "map");
    return result;
  }
}

export function createFeatureRegistry(profile: FeatureProfile = "FULL", overrides: FrameworkFeatureOptions = {}, warn?: (message: string) => void): FeatureRegistry {
  return new FeatureRegistry(profile, overrides, warn);
}

function canonical(id: FeatureId): CanonicalFeatureId { return id === "map" ? "worldMap" : id; }
