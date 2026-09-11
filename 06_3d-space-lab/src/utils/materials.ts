import { Color3, Material, Scene, StandardMaterial } from "@babylonjs/core";

export function createMaterial(scene: Scene, name: string, color: Color3, rough = 0.15): StandardMaterial {
  const material = new StandardMaterial(name, scene);
  material.diffuseColor = color;
  material.specularColor = new Color3(rough, rough, rough);
  return material;
}

export function disposeMaterials(materials: Material[]): void {
  materials.forEach((material) => material.dispose());
}
