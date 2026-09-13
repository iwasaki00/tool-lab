import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { ObjectContext } from "../objects/primitives";
import type { SeededRandom } from "../random/seededRandom";
import { createMaterial } from "../utils/materials";
import type { ResolvedCityStyle } from "./cityStyles";

export function createWaterfront(ctx: ObjectContext, extent: number): number {
  const shoreX = extent * .42;
  const water = MeshBuilder.CreateBox("coastal-water", { width: extent * 1.18, depth: extent * 2.2, height: .08 }, ctx.scene);
  water.position.set(extent, .04, 0);
  const material = createMaterial(ctx.scene, "coastal-water-material", new Color3(.06, .35, .52), .7);
  material.alpha = .82;
  material.emissiveColor = new Color3(.015, .08, .12);
  water.material = material;
  water.isPickable = false;
  return shoreX;
}

export function createLandmark(ctx: ObjectContext, style: ResolvedCityStyle, position: Vector3, lamps: StandardMaterial[]): void {
  const dark = createMaterial(ctx.scene, "landmark-dark", Color3.FromHexString(style.darkPalette ? "#24292a" : "#52616a"), .35);
  const accent = createMaterial(ctx.scene, "landmark-accent", Color3.FromHexString(style.id === "future" ? "#69eaff" : "#e3b85c"), .5);
  if (style.landmark === "future-tower") {
    const tower = MeshBuilder.CreateCylinder("landmark-future-tower", { height: 25, diameterBottom: 5.5, diameterTop: 2.2, tessellation: 12 }, ctx.scene);
    tower.position.copyFrom(position).addInPlaceFromFloats(0, 12.5, 0); tower.material = dark; tower.checkCollisions = true; ctx.shadows.addShadowCaster(tower);
    for (let y = 3; y < 24; y += 4) {
      const ring = MeshBuilder.CreateTorus("future-glow-ring", { diameter: 3.5 + y * .07, thickness: .16, tessellation: 20 }, ctx.scene);
      ring.position.copyFrom(position).addInPlaceFromFloats(0, y, 0); ring.material = accent;
    }
    accent.emissiveColor = Color3.Black(); accent.metadata = { nightColor: [.2, .92, 1] }; lamps.push(accent);
    return;
  }
  if (style.landmark === "chimney") {
    const chimney = MeshBuilder.CreateCylinder("landmark-giant-chimney", { height: 22, diameterBottom: 4.5, diameterTop: 3, tessellation: 16 }, ctx.scene);
    chimney.position.copyFrom(position).addInPlaceFromFloats(0, 11, 0); chimney.material = dark; chimney.checkCollisions = true; ctx.shadows.addShadowCaster(chimney);
    return;
  }
  const heights: Record<string, number> = { tower: 22, lookout: 16, "maze-tower": 18, monument: 12, park: 9 };
  const height = heights[style.landmark] ?? 14;
  const base = MeshBuilder.CreateCylinder("city-landmark", { height, diameter: style.landmark === "park" ? 5 : 3.2, tessellation: style.landmark === "maze-tower" ? 4 : 12 }, ctx.scene);
  base.position.copyFrom(position).addInPlaceFromFloats(0, height / 2, 0); base.material = dark; base.checkCollisions = true; ctx.shadows.addShadowCaster(base);
  const beacon = MeshBuilder.CreateSphere("landmark-beacon", { diameter: 1.3, segments: 12 }, ctx.scene);
  beacon.position.copyFrom(position).addInPlaceFromFloats(0, height + .7, 0); beacon.material = accent;
  accent.emissiveColor = Color3.Black(); accent.metadata = { nightColor: [1, .58, .15] }; lamps.push(accent);
}

export function createStyleDecoration(ctx: ObjectContext, style: ResolvedCityStyle, position: Vector3, random: SeededRandom, lamps: StandardMaterial[]): void {
  if (style.decoration === "industrial") {
    const tank = MeshBuilder.CreateCylinder("industrial-tank", { height: 4.5, diameter: 3.4, tessellation: 16 }, ctx.scene);
    tank.position.copyFrom(position).addInPlaceFromFloats(0, 2.25, 0); tank.material = createMaterial(ctx.scene, "industrial-metal", new Color3(.32, .34, .33), .45); tank.checkCollisions = true;
    const pipe = MeshBuilder.CreateTorus("industrial-pipe", { diameter: 2.1, thickness: .25, tessellation: 12 }, ctx.scene);
    pipe.position.copyFrom(position).addInPlaceFromFloats(2.1, 1.3, 0); pipe.rotation.z = Math.PI / 2; pipe.material = tank.material;
  } else if (style.decoration === "ruins") {
    const wall = MeshBuilder.CreateBox("ruined-wall", { width: random.range(2.5, 5), height: random.range(1.8, 4.5), depth: .35 }, ctx.scene);
    wall.position.copyFrom(position).addInPlaceFromFloats(0, wall.getBoundingInfo().boundingBox.extendSize.y, 0); wall.rotation.y = random.range(-.8, .8); wall.material = createMaterial(ctx.scene, "ruin-concrete", new Color3(.3, .29, .26)); wall.checkCollisions = true;
    const fallen = MeshBuilder.CreateCylinder("fallen-pillar", { height: 4, diameter: .5, tessellation: 8 }, ctx.scene);
    fallen.position.copyFrom(position).addInPlaceFromFloats(1.5, .35, 1); fallen.rotation.z = Math.PI / 2; fallen.material = wall.material; fallen.checkCollisions = true;
  } else if (style.decoration === "future") {
    const column = MeshBuilder.CreateCylinder("future-light-column", { height: 5, diameter: .38, tessellation: 10 }, ctx.scene);
    const glow = createMaterial(ctx.scene, "future-column-glow", new Color3(.1, .5, .65), .6);
    glow.emissiveColor = Color3.Black(); glow.metadata = { nightColor: [.1, .85, 1] }; lamps.push(glow);
    column.position.copyFrom(position).addInPlaceFromFloats(0, 2.5, 0); column.material = glow; column.checkCollisions = true;
  } else if (style.decoration === "utility" || style.decoration === "maze") {
    const pole = MeshBuilder.CreateCylinder("utility-pole", { height: 6, diameter: .28, tessellation: 8 }, ctx.scene);
    pole.position.copyFrom(position).addInPlaceFromFloats(0, 3, 0); pole.material = createMaterial(ctx.scene, "utility-pole-material", new Color3(.19, .17, .14)); pole.checkCollisions = true;
  }
}
