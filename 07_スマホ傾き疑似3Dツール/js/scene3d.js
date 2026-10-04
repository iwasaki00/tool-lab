import { createAquariumScene } from "./scenes/aquariumScene.js";
import { createNeonScene } from "./scenes/neonScene.js";
import { createCrystalScene } from "./scenes/crystalScene.js";
import { createModelScene } from "./scenes/modelScene.js?v=0401";
import { createDepthPhotoScene } from "./scenes/depthPhotoScene.js?v=0500";
import { GLTFLoader } from "./addons/loaders/GLTFLoader.js?v=170";

const THREE_VERSION = "0.170.0";
const THREE_MODULE_URL = "./three.module.js";
const CAMERA_Z = 7.5;
const CAMERA_RANGE_X = 1.35;
const CAMERA_RANGE_Y = 1;
const DEFAULT_FOV = 42;
const SCENE_FACTORIES = Object.freeze({
  aquarium: createAquariumScene,
  neon: createNeonScene,
  crystal: createCrystalScene,
  model: createModelScene,
  depth: createDepthPhotoScene,
});

export { THREE_VERSION };

export async function createScene3D({
  canvas,
  container,
  onStatus = () => {},
  onSceneChange = () => {},
  onModelUpdate = () => {},
  onDepthPhotoUpdate = () => {},
  depthPhotoSettings = {},
}) {
  let THREE;
  try {
    THREE = await import(THREE_MODULE_URL);
  } catch (error) {
    onStatus({ available: false, message: "Three.jsを読み込めませんでした" });
    return createUnavailableScene(error);
  }

  let webglRenderer;
  try {
    webglRenderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
  } catch (error) {
    onStatus({ available: false, message: "WebGLを利用できません" });
    return createUnavailableScene(error);
  }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(DEFAULT_FOV, 1, 0.1, 40);
  const focalTarget = new THREE.Vector3(0, -0.05, -0.55);
  camera.position.set(0, 0, CAMERA_Z);
  camera.lookAt(focalTarget);
  const windowQuaternion = camera.quaternion.clone();

  const phonePerformanceMode = window.matchMedia("(pointer: coarse)").matches
    && Math.min(window.innerWidth, window.innerHeight) <= 600;
  const effectivePixelRatio = Math.min(window.devicePixelRatio || 1, phonePerformanceMode ? 1.5 : 2);
  webglRenderer.setPixelRatio(effectivePixelRatio);
  webglRenderer.outputColorSpace = THREE.SRGBColorSpace;
  webglRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
  webglRenderer.toneMapping = THREE.ACESFilmicToneMapping;
  webglRenderer.toneMappingExposure = 1.05;

  const axes = new THREE.AxesHelper(2.2);
  axes.position.set(0, -2.15, 0.3);
  axes.visible = false;
  scene.add(axes);

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let currentScene = null;
  let currentSceneId = "";
  let switchToken = 0;
  let paused = false;
  let width = 1;
  let height = 1;
  let lastCamera = { x: 0, y: 0, z: CAMERA_Z };
  let objectCount = 0;
  let viewMode = "window";
  let calibratedFov = DEFAULT_FOV;

  function resize() {
    const rect = container.getBoundingClientRect();
    const nextWidth = Math.max(1, Math.round(rect.width));
    const nextHeight = Math.max(1, Math.round(rect.height));
    if (nextWidth === width && nextHeight === height) return;
    width = nextWidth;
    height = nextHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    webglRenderer.setSize(width, height, false);
  }

  function applySceneConfig(config) {
    scene.background = new THREE.Color(config.background);
    if (config.fog?.type === "exp2") {
      scene.fog = new THREE.FogExp2(config.fog.color, config.fog.density);
    } else if (config.fog?.type === "linear") {
      scene.fog = new THREE.Fog(config.fog.color, config.fog.near, config.fog.far);
    } else {
      scene.fog = null;
    }
    camera.fov = calibratedFov;
    camera.near = 0.1;
    camera.far = 40;
    camera.updateProjectionMatrix();
    webglRenderer.shadowMap.enabled = Boolean(config.shadows) && !phonePerformanceMode;
  }

  function countObjects() {
    let count = 0;
    currentScene?.root.traverse(() => { count += 1; });
    objectCount = count;
  }

  async function switchScene(sceneId, { immediate = false } = {}) {
    const targetId = SCENE_FACTORIES[sceneId] ? sceneId : "aquarium";
    if (currentSceneId === targetId) return currentScene?.config;
    const token = ++switchToken;
    container.classList.add("is-switching");
    if (!immediate) await delay(140);
    if (token !== switchToken) return null;

    if (currentScene) {
      currentScene.dispose?.();
      scene.remove(currentScene.root);
      disposeObjectTree(currentScene.root);
    }
    currentScene = SCENE_FACTORIES[targetId](THREE, {
      GLTFLoader,
      reducedMotion,
      phonePerformanceMode,
      onModelUpdate: (info) => {
        if (currentSceneId === targetId) countObjects();
        onModelUpdate(info);
      },
      initialSettings: depthPhotoSettings,
      onDepthPhotoUpdate: (info) => {
        if (currentSceneId === targetId) countObjects();
        onDepthPhotoUpdate(info);
      },
    });
    currentSceneId = targetId;
    scene.add(currentScene.root);
    applySceneConfig(currentScene.config);
    countObjects();
    onSceneChange({ id: currentSceneId, label: currentScene.config.label });
    window.setTimeout(() => {
      if (token === switchToken) container.classList.remove("is-switching");
    }, immediate ? 0 : 70);
    return currentScene.config;
  }

  function setViewCalibration({ viewMode: nextViewMode, fov } = {}) {
    viewMode = nextViewMode === "lookAt" ? "lookAt" : "window";
    const numericFov = Number(fov);
    calibratedFov = Number.isFinite(numericFov)
      ? Math.min(80, Math.max(35, numericFov))
      : DEFAULT_FOV;
    camera.fov = calibratedFov;
    camera.updateProjectionMatrix();
  }

  function render({ finalX = 0, finalY = 0, time = 0 } = {}) {
    if (paused || !currentScene) return;
    resize();
    const range = currentScene.config.cameraRange ?? 1;
    const cameraSettings = currentScene.getCameraSettings?.(camera.fov, camera.aspect) ?? {
      distance: CAMERA_Z,
      target: focalTarget,
      rangeX: CAMERA_RANGE_X * range,
      rangeY: CAMERA_RANGE_Y * range,
      near: 0.1,
      far: 40,
    };
    const cameraInputX = Math.min(cameraSettings.inputLimitX ?? Infinity, Math.max(-(cameraSettings.inputLimitX ?? Infinity), finalX));
    const cameraInputY = Math.min(cameraSettings.inputLimitY ?? Infinity, Math.max(-(cameraSettings.inputLimitY ?? Infinity), finalY));
    camera.position.x = cameraSettings.target.x + cameraInputX * cameraSettings.rangeX;
    camera.position.y = cameraSettings.target.y + cameraInputY * cameraSettings.rangeY;
    camera.position.z = cameraSettings.target.z + cameraSettings.distance;
    if (camera.near !== cameraSettings.near || camera.far !== cameraSettings.far) {
      camera.near = cameraSettings.near;
      camera.far = cameraSettings.far;
      camera.updateProjectionMatrix();
    }
    camera.clearViewOffset();
    if (viewMode === "lookAt") camera.lookAt(cameraSettings.target);
    else camera.quaternion.copy(windowQuaternion);
    lastCamera = { x: camera.position.x, y: camera.position.y, z: camera.position.z };
    currentScene.update?.(time);
    webglRenderer.render(scene, camera);
  }

  function getMetrics() {
    const config = currentScene?.config;
    return {
      available: true,
      camera: { ...lastCamera },
      fov: camera.fov,
      viewMode,
      width,
      height,
      devicePixelRatio: window.devicePixelRatio || 1,
      effectivePixelRatio,
      currentScene: config?.label ?? "—",
      objectCount,
      triangles: webglRenderer.info.render.triangles,
      drawCalls: webglRenderer.info.render.calls,
      geometries: webglRenderer.info.memory.geometries,
      textures: webglRenderer.info.memory.textures,
      quality: "STANDARD",
      fog: config?.fog ? config.fog.type.toUpperCase() : "OFF",
      shadows: webglRenderer.shadowMap.enabled,
      animation: paused ? "PAUSED" : "ACTIVE",
      model: currentScene?.getModelInfo?.() ?? null,
      depthPhoto: currentScene?.getDepthPhotoInfo?.() ?? null,
    };
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  await switchScene("aquarium", { immediate: true });
  resize();
  render();
  onStatus({ available: true, message: `Three.js ${THREE_VERSION}` });

  return {
    available: true,
    version: THREE_VERSION,
    render,
    resize,
    switchScene,
    setViewCalibration,
    async loadModel(file) {
      if (currentSceneId !== "model" || !currentScene?.loadFile) throw new Error("MODEL_SCENE_NOT_ACTIVE");
      const info = await currentScene.loadFile(file);
      countObjects();
      return info;
    },
    setModelLighting(preset) { return currentScene?.setLightingPreset?.(preset); },
    setModelBackground(preset) { return currentScene?.setBackgroundPreset?.(preset); },
    setModelAnimation(index) { return currentScene?.setAnimation?.(index); },
    setModelPlaying(value) { return currentScene?.setPlaying?.(value); },
    getModelInfo() { return currentScene?.getModelInfo?.() ?? null; },
    async loadDepthPhotoImage(kind, file) {
      if (currentSceneId !== "depth" || !currentScene?.loadImage) throw new Error("DEPTH_PHOTO_SCENE_NOT_ACTIVE");
      const info = await currentScene.loadImage(kind, file);
      countObjects();
      return info;
    },
    setDepthPhotoSettings(settings) { return currentScene?.setDepthSettings?.(settings); },
    getDepthPhotoInfo() { return currentScene?.getDepthPhotoInfo?.() ?? null; },
    setPaused(value) { paused = Boolean(value); },
    setDebugVisible(value) { axes.visible = Boolean(value); },
    getMetrics,
    dispose() {
      resizeObserver.disconnect();
      if (currentScene) {
        currentScene.dispose?.();
        disposeObjectTree(currentScene.root);
      }
      webglRenderer.dispose();
    },
  };
}

function disposeObjectTree(root) {
  const disposedMaterials = new Set();
  const disposedGeometries = new Set();
  root.traverse((object) => {
    if (object.isLight && object.shadow) {
      object.shadow.map?.dispose();
      object.shadow.mapPass?.dispose();
      object.shadow.map = null;
      object.shadow.mapPass = null;
    }
    if (object.geometry && !disposedGeometries.has(object.geometry)) {
      object.geometry.dispose();
      disposedGeometries.add(object.geometry);
    }
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.filter(Boolean).forEach((material) => {
      if (disposedMaterials.has(material)) return;
      Object.values(material).forEach((value) => {
        if (value?.isTexture) value.dispose();
      });
      material.dispose();
      disposedMaterials.add(material);
    });
  });
}

const delay = (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

function createUnavailableScene(error) {
  return {
    available: false,
    version: THREE_VERSION,
    error,
    render() {}, resize() {}, setPaused() {}, setDebugVisible() {}, setViewCalibration() {}, dispose() {},
    async loadModel() { throw new Error("WEBGL_UNAVAILABLE"); },
    setModelLighting() {}, setModelBackground() {}, setModelAnimation() {}, setModelPlaying() {},
    async loadDepthPhotoImage() { throw new Error("WEBGL_UNAVAILABLE"); },
    setDepthPhotoSettings() {}, getDepthPhotoInfo() { return null; },
    getModelInfo() { return null; },
    async switchScene() { return null; },
    getMetrics() {
      return {
        available: false,
        camera: { x: 0, y: 0, z: CAMERA_Z },
        fov: DEFAULT_FOV,
        viewMode: "window",
        width: 0,
        height: 0,
        devicePixelRatio: window.devicePixelRatio || 1,
        effectivePixelRatio: 0,
        currentScene: "UNAVAILABLE",
        objectCount: 0,
        triangles: 0,
        drawCalls: 0,
        geometries: 0,
        textures: 0,
        quality: "STANDARD",
        fog: "OFF",
        shadows: false,
        animation: "PAUSED",
        model: null,
        depthPhoto: null,
      };
    },
  };
}
