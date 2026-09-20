import type { Camera } from "@babylonjs/core/Cameras/camera";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { Observer } from "@babylonjs/core/Misc/observable";
import { Scene } from "@babylonjs/core/scene";
import { setStreetLightsEnabled } from "../objects/streetLight";
import { MaterialLibrary } from "./MaterialLibrary";
import { DEFAULT_VISUAL_FEATURES, VISUAL_PALETTE, type EnvironmentPreset, type FogPreset, type ResolvedVisualQuality, type VisualConfig, type VisualFeatureConfig, type VisualQuality, type VisualState } from "./VisualConfig";

interface EnvironmentValues { sky: Color3; horizon: Color3; sun: Color3; ambient: Color3; sunIntensity: number; ambientIntensity: number; fog: FogPreset; cloudCount: number }

export class VisualManager {
  readonly materials: MaterialLibrary;
  readonly ambient: HemisphericLight;
  readonly sun: DirectionalLight;
  readonly shadows: ShadowGenerator;
  private readonly sky: Mesh;
  private readonly skyMaterial: StandardMaterial;
  private readonly clouds: Mesh[] = [];
  private readonly cloudMaterial: StandardMaterial;
  private readonly observer: Observer<Scene>;
  private environment: EnvironmentPreset;
  private quality: VisualQuality;
  private resolvedQuality: ResolvedVisualQuality;
  private fogOverride?: FogPreset;
  private features: VisualFeatureConfig;
  private streetLights: StandardMaterial[] = [];
  private lastLodUpdate = 0;
  private lod: 0 | 1 | 2 = 0;
  private readonly lightDebugMeshes: Mesh[] = [];

  constructor(private readonly scene: Scene, private readonly camera: Camera, private readonly mobile: boolean, config: Partial<VisualConfig> = {}) {
    this.environment = config.environmentPreset ?? "CLEAR_DAY"; this.quality = config.quality ?? "AUTO"; this.resolvedQuality = resolveQuality(this.quality, mobile); this.features = { ...DEFAULT_VISUAL_FEATURES, ...config.features }; this.fogOverride = config.fog;
    this.materials = new MaterialLibrary(scene);
    this.ambient = new HemisphericLight("visual-ambient", new Vector3(0, 1, 0), scene); this.ambient.groundColor = new Color3(.16, .19, .2);
    this.sun = new DirectionalLight("visual-sun", new Vector3(-.55, -1, .35), scene); this.sun.position = new Vector3(25, 38, -25);
    this.shadows = new ShadowGenerator(mobile ? 1024 : 2048, this.sun); this.shadows.bias = .0008; this.shadows.normalBias = .025;
    this.sky = MeshBuilder.CreateSphere("visual-sky", { diameter: 1600, segments: mobile ? 12 : 20, sideOrientation: Mesh.BACKSIDE }, scene); this.sky.infiniteDistance = true; this.sky.isPickable = false;
    this.skyMaterial = new StandardMaterial("visual-sky-material", scene); this.skyMaterial.disableLighting = true; this.skyMaterial.backFaceCulling = false; this.skyMaterial.metadata = { sharedVisual: true, visualRole: "sky" }; this.sky.material = this.skyMaterial;
    this.cloudMaterial = new StandardMaterial("visual-cloud-material", scene); this.cloudMaterial.disableLighting = true; this.cloudMaterial.backFaceCulling = false; this.cloudMaterial.diffuseColor = Color3.White(); this.cloudMaterial.emissiveColor = new Color3(.75, .79, .81); this.cloudMaterial.alpha = .27; this.cloudMaterial.metadata = { sharedVisual: true, visualRole: "cloud" };
    this.createClouds(); this.applyQuality(); this.applyEnvironment(); this.observer = scene.onBeforeRenderObservable.add(() => this.update())!;
  }

  setEnvironmentPreset(preset: EnvironmentPreset): void { this.environment = preset; this.applyEnvironment(); }
  setQuality(quality: VisualQuality): void { this.quality = quality; this.resolvedQuality = resolveQuality(quality, this.mobile); this.applyQuality(); this.applyEnvironment(); }
  setFog(fog?: FogPreset): void { this.fogOverride = fog; this.applyEnvironment(); }
  setFeatures(features: Partial<VisualFeatureConfig>): void { this.features = { ...this.features, ...features }; this.applyQuality(); this.applyEnvironment(); }
  setStreetLightMaterials(materials: StandardMaterial[]): void { this.streetLights = materials; this.updateEmissiveState(); }
  setDebugView(kind: "LIGHTS" | "LOD" | "CHUNK_LOD", enabled: boolean): void {
    if (kind === "LIGHTS") { this.lightDebugMeshes.splice(0).forEach((mesh) => mesh.dispose()); if (enabled) this.scene.lights.forEach((light, index) => { const marker = MeshBuilder.CreateSphere(`visual-light-debug-${index}`, { diameter: .35, segments: 6 }, this.scene); marker.position.copyFrom(light.getAbsolutePosition()); marker.material = this.materials.getPaintMaterial(); marker.isPickable = false; this.lightDebugMeshes.push(marker); }); return; }
    this.scene.meshes.forEach((mesh) => { if (kind === "LOD" && mesh.metadata?.visualLod !== undefined) mesh.showBoundingBox = enabled; if (kind === "CHUNK_LOD" && mesh.metadata?.mapChunkId) mesh.showBoundingBox = enabled; });
  }
  async transitionTo(preset: EnvironmentPreset, durationMs = 1500): Promise<void> { if (durationMs <= 0) { this.setEnvironmentPreset(preset); return; } const start = this.scene.imageProcessingConfiguration.exposure; this.scene.imageProcessingConfiguration.exposure = start * .82; await delay(Math.min(durationMs / 2, 500)); this.setEnvironmentPreset(preset); this.scene.imageProcessingConfiguration.exposure = start; }
  state(): VisualState { const active = this.scene.getActiveMeshes(); return { environment: this.environment, quality: this.quality, resolvedQuality: this.resolvedQuality, fog: this.activeFog(), shadow: this.scene.shadowsEnabled && this.features.shadows, lod: this.lod, activeLights: this.scene.lights.filter((light) => light.isEnabled()).length, materials: this.scene.materials.length, meshes: this.scene.meshes.length, activeMeshes: active.length, shadowCasters: this.shadows.getShadowMap()?.renderList?.length ?? 0, features: { ...this.features } }; }
  dispose(): void { this.scene.onBeforeRenderObservable.remove(this.observer); this.lightDebugMeshes.forEach((mesh) => mesh.dispose()); this.clouds.forEach((cloud) => cloud.dispose()); this.sky.dispose(); this.cloudMaterial.dispose(); this.skyMaterial.dispose(); this.shadows.dispose(); this.ambient.dispose(); this.sun.dispose(); this.materials.dispose(); }

  private applyEnvironment(): void {
    const value = environmentValues(this.environment); this.scene.clearColor = new Color4(value.horizon.r, value.horizon.g, value.horizon.b, 1); this.skyMaterial.diffuseColor = value.sky; this.skyMaterial.emissiveColor = value.sky; this.sun.diffuse = value.sun; this.sun.intensity = value.sunIntensity; this.ambient.diffuse = value.ambient; this.ambient.intensity = value.ambientIntensity;
    this.sun.direction = this.environment === "SUNSET" ? new Vector3(-.85, -.34, .28) : new Vector3(-.55, -1, .35); this.sky.setEnabled(this.features.sky); this.applyFog(this.activeFog());
    const maxClouds = this.resolvedQuality === "LOW" ? 5 : this.resolvedQuality === "MEDIUM" ? 10 : 16; this.clouds.forEach((cloud, index) => cloud.setEnabled(this.features.clouds && index < Math.min(maxClouds, value.cloudCount))); this.cloudMaterial.diffuseColor = this.environment === "SUNSET" ? new Color3(.94, .58, .45) : this.environment === "NIGHT" ? new Color3(.18, .23, .32) : new Color3(.82, .85, .85); this.cloudMaterial.emissiveColor = this.cloudMaterial.diffuseColor.scale(.72); this.cloudMaterial.alpha = this.environment === "CLOUDY" || this.environment === "FOGGY" ? .42 : .25;
    this.updateEmissiveState();
  }
  private applyQuality(): void {
    this.scene.shadowsEnabled = this.features.shadows && this.resolvedQuality !== "LOW"; this.shadows.usePoissonSampling = this.resolvedQuality === "MEDIUM"; this.shadows.useBlurExponentialShadowMap = this.resolvedQuality === "HIGH"; this.shadows.blurKernel = this.resolvedQuality === "HIGH" ? 24 : 8;
    this.scene.imageProcessingConfiguration.contrast = this.resolvedQuality === "HIGH" ? 1.12 : 1.06; this.scene.imageProcessingConfiguration.exposure = this.environment === "NIGHT" ? .92 : 1.04;
  }
  private applyFog(fog: FogPreset): void { if (!this.features.fog || fog === "OFF") { this.scene.fogMode = Scene.FOGMODE_NONE; return; } const value = environmentValues(this.environment); this.scene.fogMode = Scene.FOGMODE_LINEAR; this.scene.fogColor = value.horizon; const ranges = this.resolvedQuality === "LOW" ? [35, 105] : this.resolvedQuality === "MEDIUM" ? [48, 145] : [65, 210]; const factor = fog === "HEAVY" ? .45 : fog === "MEDIUM" ? .68 : 1; this.scene.fogStart = ranges[0] * factor; this.scene.fogEnd = ranges[1] * factor; }
  private activeFog(): FogPreset { return this.fogOverride ?? environmentValues(this.environment).fog; }
  private updateEmissiveState(): void { const night = this.environment === "NIGHT"; setStreetLightsEnabled(this.streetLights, night); this.scene.materials.forEach((material) => { if (!(material instanceof StandardMaterial) || material.metadata?.visualRole !== "window") return; material.emissiveColor = night ? new Color3(.34, .26, .12) : new Color3(.01, .025, .035); }); }
  private createClouds(): void { for (let index = 0; index < 16; index += 1) { const cloud = MeshBuilder.CreatePlane(`visual-cloud-${index}`, { width: 20 + index % 4 * 5, height: 7 + index % 3 * 2 }, this.scene); const angle = index * 2.399; const radius = 45 + index % 5 * 15; cloud.position.set(Math.cos(angle) * radius, 35 + index % 4 * 4, Math.sin(angle) * radius); cloud.rotation.x = Math.PI / 2; cloud.rotation.z = angle; cloud.material = this.cloudMaterial; cloud.isPickable = false; cloud.metadata = { visualRole: "cloud", visualLod: 2 }; this.clouds.push(cloud); } }
  private update(): void { const now = performance.now(); if (now - this.lastLodUpdate < 350) return; this.lastLodUpdate = now; const distance = Math.hypot(this.camera.position.x, this.camera.position.z); this.lod = distance > 150 ? 2 : distance > 70 ? 1 : 0; const decorationDistance = this.resolvedQuality === "LOW" ? 50 : this.resolvedQuality === "MEDIUM" ? 90 : 150; this.scene.meshes.forEach((mesh) => { const visualLod = mesh.metadata?.visualLod as number | undefined; if (visualLod === undefined || mesh.metadata?.visualRole === "cloud") return; mesh.setEnabled(Vector3.DistanceSquared(mesh.getAbsolutePosition(), this.camera.position) <= decorationDistance * decorationDistance || visualLod >= 2); }); const anchorX = Math.round(this.camera.position.x / 80) * 80; const anchorZ = Math.round(this.camera.position.z / 80) * 80; this.clouds.forEach((cloud) => { cloud.position.x = anchorX + (cloud.metadata?.cloudOffsetX ?? cloud.position.x); cloud.position.z = anchorZ + (cloud.metadata?.cloudOffsetZ ?? cloud.position.z); cloud.metadata = { ...cloud.metadata, cloudOffsetX: cloud.metadata?.cloudOffsetX ?? cloud.position.x - anchorX, cloudOffsetZ: cloud.metadata?.cloudOffsetZ ?? cloud.position.z - anchorZ }; }); }
}

function resolveQuality(quality: VisualQuality, mobile: boolean): ResolvedVisualQuality { return quality === "AUTO" ? mobile ? "LOW" : "HIGH" : quality; }
function environmentValues(preset: EnvironmentPreset): EnvironmentValues { const p = preset === "CLEAR_DAY" ? VISUAL_PALETTE.clearDay : preset === "CLOUDY" ? VISUAL_PALETTE.cloudy : preset === "SUNSET" ? VISUAL_PALETTE.sunset : preset === "NIGHT" ? VISUAL_PALETTE.night : VISUAL_PALETTE.foggy; return { sky: Color3.FromHexString(p.sky), horizon: Color3.FromHexString(p.horizon), sun: Color3.FromHexString(p.sun), ambient: Color3.FromHexString(p.ambient), sunIntensity: preset === "NIGHT" ? .16 : preset === "SUNSET" ? .82 : preset === "CLOUDY" || preset === "FOGGY" ? .62 : 1.15, ambientIntensity: preset === "NIGHT" ? .25 : preset === "SUNSET" ? .5 : preset === "CLOUDY" || preset === "FOGGY" ? .58 : .7, fog: preset === "FOGGY" ? "HEAVY" : preset === "CLOUDY" ? "LIGHT" : "OFF", cloudCount: preset === "CLOUDY" || preset === "FOGGY" ? 16 : preset === "SUNSET" ? 9 : preset === "NIGHT" ? 5 : 7 }; }
function delay(ms: number): Promise<void> { return new Promise((resolve) => window.setTimeout(resolve, ms)); }
