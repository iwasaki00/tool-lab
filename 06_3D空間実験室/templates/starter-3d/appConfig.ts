import type { CreateFrameworkOptions } from "../../src/framework/index";

export const appConfig: Omit<CreateFrameworkOptions, "canvas" | "mobile"> = {
  profile: "MINIMAL",
  features: { navigation: false, interiors: false, missions: false, npc: false, enemies: false },
  world: { mode: "city", city: { seed: 20260922, style: "suburban" } },
  config: { map: { autoExpansion: true, chunkUnload: true }, visual: { quality: "AUTO" } },
};
