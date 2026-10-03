import { createAquariumScene } from "./scenes/aquariumScene.js";
import { createNeonScene } from "./scenes/neonScene.js";
import { createCrystalScene } from "./scenes/crystalScene.js";

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
});

export { THREE_VERSION };

export async function createScene3D({ canvas, container, onStatus = () => {}, onSceneChange = () => {} }) {
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
    camera.fov = config.fov ?? DEFAULT_FOV;
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
      scene.remove(currentScene.root);
      disposeObjectTree(currentScene.root);
    }
    currentScene = SCENE_FACTORIES[targetId](THREE, { reducedMotion });
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

  function render({ cameraViewX = 0, cameraViewY = 0, time = 0 } = {}) {
    if (paused || !currentScene) return;
    resize();
    const range = currentScene.config.cameraRange ?? 1;
    camera.position.x = cameraViewX * CAMERA_RANGE_X * range;
    camera.position.y = cameraViewY * CAMERA_RANGE_Y * range;
    camera.position.z = CAMERA_Z;
    camera.lookAt(focalTarget);
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
    setPaused(value) { paused = Boolean(value); },
    setDebugVisible(value) { axes.visible = Boolean(value); },
    getMetrics,
    dispose() {
      resizeObserver.disconnect();
      if (currentScene) disposeObjectTree(currentScene.root);
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
    render() {}, resize() {}, setPaused() {}, setDebugVisible() {}, dispose() {},
    async switchScene() { return null; },
    getMetrics() {
      return {
        available: false,
        camera: { x: 0, y: 0, z: CAMERA_Z },
        fov: DEFAULT_FOV,
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
      };
    },
  };
}
