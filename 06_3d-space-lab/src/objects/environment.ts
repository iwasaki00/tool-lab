import { Color3 } from "@babylonjs/core/Maths/math.color";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import type { Scene } from "@babylonjs/core/scene";
import { createMaterial } from "../utils/materials";

export function createGround(scene: Scene): Mesh {
  const ground = MeshBuilder.CreateGround("experiment-ground", { width: 90, height: 90, subdivisions: 2 }, scene);
  const material = createMaterial(scene, "ground-material", new Color3(0.25, 0.34, 0.28), 0.05);
  material.diffuseTexture = null;
  ground.material = material;
  ground.checkCollisions = true;
  ground.receiveShadows = true;
  return ground;
}

export function createRoad(scene: Scene, position: Vector3, width: number, length: number, rotation = 0): Mesh {
  const road = MeshBuilder.CreateBox("road", { width, depth: length, height: .06 }, scene);
  road.position.copyFrom(position);
  road.rotation.y = rotation;
  road.material = createMaterial(scene, "road-material", new Color3(0.12, 0.15, 0.17), 0.05);
  road.checkCollisions = true;
  road.receiveShadows = true;
  return road;
}

export function createLamp(scene: Scene, shadows: ShadowGenerator, position: Vector3): Mesh {
  const root = new Mesh("lamp", scene);
  root.position.copyFrom(position);
  const dark = createMaterial(scene, "lamp-post-mat", new Color3(.13, .16, .18));
  const glow = createMaterial(scene, "lamp-glow-mat", new Color3(.8, .72, .38), .5);
  glow.emissiveColor = new Color3(.9, .68, .22);
  const pole = MeshBuilder.CreateCylinder("lamp-pole", { height: 4.4, diameter: .16, tessellation: 12 }, scene);
  pole.position.y = 2.2; pole.parent = root; pole.material = dark; pole.checkCollisions = true; shadows.addShadowCaster(pole);
  const head = MeshBuilder.CreateBox("lamp-head", { width: .7, height: .28, depth: .7 }, scene);
  head.position.y = 4.35; head.parent = root; head.material = glow; shadows.addShadowCaster(head);
  return root;
}

export function createSky(scene: Scene): StandardMaterial {
  const sky = MeshBuilder.CreateSphere("sky", { diameter: 150, segments: 24, sideOrientation: Mesh.BACKSIDE }, scene);
  const material = new StandardMaterial("sky-material", scene);
  material.disableLighting = true;
  material.diffuseColor = new Color3(.34, .62, .82);
  material.emissiveColor = new Color3(.34, .62, .82);
  sky.material = material;
  sky.isPickable = false;
  return material;
}
