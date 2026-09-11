import { Color3, Color4, DirectionalLight, Engine, HemisphericLight, Mesh, Scene, ShadowGenerator, Vector3 } from "@babylonjs/core";
import { createBoundaryWall, createBuilding, createStairs } from "../objects/building";
import { createGround, createLamp, createRoad, createSky } from "../objects/environment";
import { createBox, createCylinder, createPillar, createPlatform, createSphere, type ObjectContext } from "../objects/primitives";
import { createPlayer } from "../player/createPlayer";
import { createRandomScene, randomOpenPosition } from "./generators";

export interface LaboratoryApi {
  scene: Scene;
  setDayMode: (isDay: boolean) => void;
  addBox: () => void;
  addSphere: () => void;
  addBuilding: () => void;
  randomize: () => void;
  objectCount: () => number;
  telemetry: () => { x: number; z: number; mode: "day" | "night" };
}

export function createLaboratoryScene(engine: Engine, canvas: HTMLCanvasElement): LaboratoryApi {
  const scene = new Scene(engine);
  scene.clearColor = new Color4(.38, .65, .82, 1);
  scene.gravity = new Vector3(0, -.22, 0);
  scene.collisionsEnabled = true;
  const camera = createPlayer(scene, canvas);

  const ambient = new HemisphericLight("ambient", new Vector3(0, 1, 0), scene);
  ambient.intensity = .68;
  ambient.groundColor = new Color3(.17, .2, .22);
  const sun = new DirectionalLight("sun", new Vector3(-.55, -1, .35), scene);
  sun.position = new Vector3(25, 38, -25);
  sun.intensity = 1.15;
  const shadows = new ShadowGenerator(2048, sun);
  shadows.useBlurExponentialShadowMap = true;
  shadows.blurKernel = 24;
  const skyMaterial = createSky(scene);
  let currentMode: "day" | "night" = "day";

  const dynamicRoots: Mesh[] = [];
  const registerDynamic = (mesh: Mesh) => dynamicRoots.push(mesh);
  const ctx: ObjectContext = { scene, shadows, registerDynamic };

  createGround(scene);
  createRoad(scene, new Vector3(0, .035, 1), 7, 76);
  createRoad(scene, new Vector3(0, .04, 8), 5, 52, Math.PI / 2);
  createInitialField(ctx);

  const spawnAhead = (height: number): Vector3 => {
    const direction = camera.getForwardRay().direction.clone();
    direction.y = 0;
    direction.normalize();
    return camera.position.add(direction.scale(5)).set(camera.position.x + direction.x * 5, height, camera.position.z + direction.z * 5);
  };

  const setDayMode = (isDay: boolean) => {
    currentMode = isDay ? "day" : "night";
    if (isDay) {
      scene.clearColor = new Color4(.38, .65, .82, 1);
      skyMaterial.diffuseColor = new Color3(.34, .62, .82);
      skyMaterial.emissiveColor = new Color3(.34, .62, .82);
      ambient.intensity = .68;
      sun.intensity = 1.15;
    } else {
      scene.clearColor = new Color4(.025, .055, .11, 1);
      skyMaterial.diffuseColor = new Color3(.025, .055, .11);
      skyMaterial.emissiveColor = new Color3(.025, .055, .11);
      ambient.intensity = .27;
      sun.intensity = .18;
    }
  };

  return {
    scene,
    setDayMode,
    addBox: () => createBox(ctx, spawnAhead(.85), 1.7, true),
    addSphere: () => createSphere(ctx, spawnAhead(.85), 1.7, true),
    addBuilding: () => createBuilding(ctx, { position: randomOpenPosition(15, 27), width: 6.5, depth: 5.5, color: new Color3(.28, .58, .66), rotation: Math.random() * Math.PI * 2, dynamic: true }),
    randomize: () => createRandomScene(ctx, dynamicRoots),
    objectCount: () => scene.meshes.filter((mesh) => mesh.name !== "sky").length,
    telemetry: () => ({ x: camera.position.x, z: camera.position.z, mode: currentMode }),
  };
}

function createInitialField(ctx: ObjectContext): void {
  const buildingData = [
    { position: new Vector3(-13, 0, 2), color: new Color3(.78, .42, .24), rotation: Math.PI / 2 },
    { position: new Vector3(13, 0, 4), color: new Color3(.24, .53, .62), rotation: -Math.PI / 2 },
    { position: new Vector3(-11, 0, 22), color: new Color3(.62, .55, .28), rotation: Math.PI / 2 },
  ];
  buildingData.forEach((data) => createBuilding(ctx, data));
  createStairs(ctx, new Vector3(9, 0, 20), 7);
  createPlatform(ctx, new Vector3(9, .32, 25), 7, 6);
  [[6.2, 2.7, 22], [11.8, 2.7, 22], [6.2, 2.7, 27.5], [11.8, 2.7, 27.5]].forEach(([x,y,z]) => createPillar(ctx, new Vector3(x,y,z), 5.4));
  createBox(ctx, new Vector3(3, .8, 9), 1.6);
  createSphere(ctx, new Vector3(-3, .9, 10), 1.8);
  createCylinder(ctx, new Vector3(4, 1.25, 16), 2.5, 1.35);
  [-31, 31].forEach((x) => createBoundaryWall(ctx.scene, ctx.shadows, new Vector3(x, 1.4, 0), { width: .7, height: 2.8, depth: 63 }));
  [-31, 31].forEach((z) => createBoundaryWall(ctx.scene, ctx.shadows, new Vector3(0, 1.4, z), { width: 63, height: 2.8, depth: .7 }));
  for (let z = -22; z <= 26; z += 12) {
    createLamp(ctx.scene, ctx.shadows, new Vector3(-4.5, 0, z));
    createLamp(ctx.scene, ctx.shadows, new Vector3(4.5, 0, z));
  }
}
