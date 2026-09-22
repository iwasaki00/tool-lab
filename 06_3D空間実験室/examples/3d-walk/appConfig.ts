import type { CreateFrameworkOptions } from "../../src/framework/index";

export const walkAppConfig: Omit<CreateFrameworkOptions, "canvas" | "mobile"> = {
  profile: "EXPLORATION",
  features: {
    interiors: false,
    navigation: false,
    missions: false,
    inventory: false,
    npc: false,
    enemies: false,
    dialogue: false,
    missionGuide: false,
    interaction: true,
    dayNight: true,
    vegetation: true,
    debugTools: false,
  },
  world: { mode: "city", city: { seed: 314159, style: "coastal" } },
  config: { map: { autoExpansion: true, chunkUnload: true }, visual: { quality: "AUTO" } },
};
