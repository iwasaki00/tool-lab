import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { createBench } from "../objects/bench";
import { createStreetLight } from "../objects/streetLight";
import { createTree } from "../objects/tree";
import type { ObjectContext } from "../objects/primitives";
import type { SeededRandom } from "../random/seededRandom";
import { createMaterial } from "../utils/materials";

export function createPark(ctx: ObjectContext, center: Vector3, size: number, random: SeededRandom, lamps: StandardMaterial[]): Mesh {
  const root = new Mesh("city-park", ctx.scene);
  root.position.copyFrom(center);
  const grass = MeshBuilder.CreateBox("park-ground", { width: size, depth: size, height: .1 }, ctx.scene);
  grass.position.y = .05; grass.parent = root; grass.material = ctx.materials?.getGrassMaterial() ?? createMaterial(ctx.scene, "park-grass", new Color3(.19, .43, .2)); grass.checkCollisions = true;
  const plaza = MeshBuilder.CreateCylinder("park-plaza", { height: .08, diameter: size * .42, tessellation: 20 }, ctx.scene);
  plaza.position.y = .11; plaza.parent = root; plaza.material = ctx.materials?.getConcreteMaterial(new Color3(.58, .54, .45)) ?? createMaterial(ctx.scene, "park-plaza", new Color3(.58, .54, .45)); plaza.checkCollisions = true;
  ctx.registerDynamic?.(root);
  for (let i = 0; i < 5; i += 1) {
    const angle = i / 5 * Math.PI * 2 + random.range(-.2, .2);
    const radius = size * .33;
    createTree(ctx, new Vector3(center.x + Math.cos(angle) * radius, .12, center.z + Math.sin(angle) * radius), random.range(.8, 1.12));
  }
  createBench(ctx, new Vector3(center.x - size * .18, .12, center.z), Math.PI / 2);
  createBench(ctx, new Vector3(center.x + size * .18, .12, center.z), -Math.PI / 2);
  createStreetLight(ctx, new Vector3(center.x, .12, center.z - size * .34), lamps);
  createFence(ctx, center, size);
  return root;
}

export function createPlaza(ctx: ObjectContext, center: Vector3, size: number, lamps: StandardMaterial[]): Mesh {
  const root = new Mesh("city-plaza", ctx.scene);
  root.position.copyFrom(center);
  const floor = MeshBuilder.CreateBox("plaza-floor", { width: size, depth: size, height: .12 }, ctx.scene);
  floor.position.y = .06; floor.parent = root; floor.material = ctx.materials?.getConcreteMaterial(new Color3(.55, .52, .47)) ?? createMaterial(ctx.scene, "plaza-stone", new Color3(.55, .52, .47)); floor.checkCollisions = true;
  const base = MeshBuilder.CreateCylinder("plaza-center", { height: .5, diameter: 2.8, tessellation: 16 }, ctx.scene);
  base.position.y = .25; base.parent = root; base.material = createMaterial(ctx.scene, "plaza-center", new Color3(.27, .39, .43)); base.checkCollisions = true;
  ctx.registerDynamic?.(root);
  createBench(ctx, new Vector3(center.x, .12, center.z - size * .3), 0);
  createStreetLight(ctx, new Vector3(center.x - size * .36, .12, center.z), lamps);
  createStreetLight(ctx, new Vector3(center.x + size * .36, .12, center.z), lamps);
  return root;
}

function createFence(ctx: ObjectContext, center: Vector3, size: number): void {
  const root = new Mesh("park-fence", ctx.scene);
  root.position.copyFrom(center);
  const material = ctx.materials?.getWoodMaterial() ?? createMaterial(ctx.scene, "park-fence", new Color3(.25, .19, .12));
  const rails = [
    { x: 0, z: size / 2, width: size, depth: .14 },
    { x: -size / 2, z: 0, width: .14, depth: size },
    { x: size / 2, z: 0, width: .14, depth: size },
  ];
  rails.forEach((rail) => {
    const mesh = MeshBuilder.CreateBox("park-fence-rail", { width: rail.width, depth: rail.depth, height: .75 }, ctx.scene);
    mesh.position.set(rail.x, .48, rail.z); mesh.parent = root; mesh.material = material; mesh.checkCollisions = true;
  });
  ctx.registerDynamic?.(root);
}
