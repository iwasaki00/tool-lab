import { readFile } from "node:fs/promises";
import * as THREE from "../js/three.module.js";
import { GLTFLoader } from "../js/addons/loaders/GLTFLoader.js";
import { createModelScene } from "../js/scenes/modelScene.js";

const bytes = await readFile(new URL("../assets/models/sample-viewer.glb", import.meta.url));
const scene = createModelScene(THREE, { GLTFLoader, reducedMotion: true });

for (let pass = 1; pass <= 2; pass += 1) {
  const file = new File([bytes], `object-smoke-${pass}.glb`, { type: "model/gltf-binary" });
  await scene.loadFile(file);
  scene.getCameraSettings(42, 0.72);
  const info = scene.getModelInfo();
  if (!info.loaded || info.loaderState !== "OBJECT READY") throw new Error(`pass ${pass}: object not ready`);
  if (!info.meshCount || !info.triangleCount || !info.materialCount) throw new Error(`pass ${pass}: geometry stats missing`);
  if (![info.dimensions.x, info.dimensions.y, info.dimensions.z, info.scale, info.baseCameraDistance].every(Number.isFinite)) {
    throw new Error(`pass ${pass}: framing metrics invalid`);
  }
  console.log(`PASS ${pass}: ${info.name} / ${info.meshCount} meshes / ${info.triangleCount} triangles / ${info.animationCount} clips`);
}

scene.dispose();
console.log("GLB load, reload, auto framing, animation metadata, and dispose passed");
