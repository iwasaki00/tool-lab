import { Color3 } from "@babylonjs/core/Maths/math.color";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { Scene } from "@babylonjs/core/scene";

export class MaterialLibrary {
  private readonly cache = new Map<string, StandardMaterial>();
  constructor(private readonly scene: Scene) {}

  getRoadMaterial(color = new Color3(.075, .09, .105)): StandardMaterial { return this.get("road", color, .035); }
  getConcreteMaterial(color = new Color3(.45, .47, .46)): StandardMaterial { return this.get("concrete", color, .06); }
  getGlassMaterial(): StandardMaterial { const material = this.get("glass", new Color3(.12, .29, .4), .62, "window"); material.alpha = .92; return material; }
  getMetalMaterial(): StandardMaterial { return this.get("metal", new Color3(.12, .14, .16), .42); }
  getWoodMaterial(): StandardMaterial { return this.get("wood", new Color3(.34, .2, .11), .12); }
  getGrassMaterial(): StandardMaterial { return this.getGroundMaterial("grass", new Color3(.22, .38, .22)); }
  getPaintMaterial(): StandardMaterial { return this.get("road-paint", new Color3(.91, .9, .78), .04); }
  getLampMaterial(): StandardMaterial { const material = this.get("street-lamp", new Color3(.85, .76, .42), .5, "streetLight"); material.metadata = { ...material.metadata, nightColor: [1, .72, .22] }; return material; }
  getBuildingMaterial(style: string, color: Color3): StandardMaterial { return this.get(`building-${style}`, color, .08); }
  getRoofMaterial(style: string, color: Color3): StandardMaterial { return this.get(`roof-${style}`, color, .12); }
  getGroundMaterial(kind = "ground", color = new Color3(.25, .34, .28)): StandardMaterial {
    const key = `${kind}:${hex(color)}`; const existing = this.cache.get(key); if (existing) return existing;
    const material = this.create(key, color, .025); const texture = new DynamicTexture(`visual-${kind}-texture`, { width: 128, height: 128 }, this.scene, false);
    const context = texture.getContext(); context.fillStyle = color.toHexString(); context.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 180; i += 1) { const shade = i % 2 ? "rgba(255,255,255,.025)" : "rgba(0,0,0,.03)"; context.fillStyle = shade; context.fillRect((i * 37) % 128, (i * 71) % 128, 1 + i % 3, 1 + i % 2); }
    texture.update(); texture.uScale = 18; texture.vScale = 18; material.diffuseTexture = texture; return material;
  }
  count(): number { return this.cache.size; }
  dispose(): void { this.cache.forEach((material) => material.dispose(true, true)); this.cache.clear(); }

  private get(role: string, color: Color3, specular: number, visualRole?: string): StandardMaterial { const key = `${role}:${hex(color)}`; return this.cache.get(key) ?? this.create(key, color, specular, visualRole); }
  private create(key: string, color: Color3, specular: number, visualRole?: string): StandardMaterial {
    const material = new StandardMaterial(`visual-${key}`, this.scene); material.diffuseColor = color.clone(); material.specularColor = new Color3(specular, specular, specular); material.metadata = { sharedVisual: true, visualRole }; this.cache.set(key, material); return material;
  }
}

function hex(color: Color3): string { return color.toHexString().replace("#", "").toLowerCase(); }
