const TARGET_MODEL_SIZE = 3.35;
const HEAVY_TRIANGLE_THRESHOLD = 500000;

export function createModelScene(THREE, { GLTFLoader, reducedMotion = false, onModelUpdate = () => {} } = {}) {
  const root = new THREE.Group();
  root.name = "OBJECT";

  const environment = new THREE.Group();
  environment.name = "VIEWER_ENVIRONMENT";
  const lightRig = new THREE.Group();
  lightRig.name = "VIEWER_LIGHTS";
  const modelRoot = new THREE.Group();
  modelRoot.name = "MODEL_ROOT";
  root.add(environment, lightRig, modelRoot);

  const backdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 30),
    new THREE.MeshStandardMaterial({ color: 0x080d17, roughness: 1, metalness: 0 }),
  );
  backdrop.name = "VIEWER_BACKDROP";
  backdrop.position.set(0, 0.5, -6);
  environment.add(backdrop);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(8, 64),
    new THREE.MeshStandardMaterial({ color: 0x101827, roughness: 0.88, metalness: 0.04 }),
  );
  floor.name = "VIEWER_FLOOR";
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.95;
  floor.receiveShadow = true;
  environment.add(floor);

  const grid = new THREE.GridHelper(16, 24, 0x70f5dc, 0x29394a);
  grid.name = "VIEWER_GRID";
  grid.position.y = -1.94;
  grid.material.transparent = true;
  grid.material.opacity = 0.34;
  environment.add(grid);

  let content = createPlaceholderModel(THREE);
  modelRoot.add(content);
  let mixer = null;
  let clips = [];
  let currentAction = null;
  let currentAnimationIndex = -1;
  let playing = false;
  let lastTime = 0;
  let lightingPreset = "studio";
  let backgroundPreset = "dark";
  let modelInfo = createEmptyInfo();
  let loadRequestId = 0;
  let disposed = false;

  applyLightingPreset("studio");
  applyBackgroundPreset("dark");
  frameContent(content, { name: "TILT OBJECT", loaded: false, loadTime: 0, loaderState: "OBJECT READY" });
  emitUpdate();

  function emitUpdate(extra = {}) {
    onModelUpdate({ ...getInfo(), ...extra });
  }

  function frameContent(object, metadata) {
    object.updateMatrixWorld(true);
    const sourceBox = new THREE.Box3().setFromObject(object);
    if (sourceBox.isEmpty()) throw new Error("EMPTY_MODEL");

    const sourceCenter = sourceBox.getCenter(new THREE.Vector3());
    const sourceSize = sourceBox.getSize(new THREE.Vector3());
    const sourceMaxDimension = Math.max(sourceSize.x, sourceSize.y, sourceSize.z);
    if (!Number.isFinite(sourceMaxDimension) || sourceMaxDimension <= 0) throw new Error("EMPTY_MODEL");

    const scale = TARGET_MODEL_SIZE / sourceMaxDimension;
    object.position.sub(sourceCenter);
    object.scale.multiplyScalar(scale);
    object.updateMatrixWorld(true);

    const framedBox = new THREE.Box3().setFromObject(object);
    const framedCenter = framedBox.getCenter(new THREE.Vector3());
    object.position.sub(framedCenter);
    object.updateMatrixWorld(true);

    const finalBox = new THREE.Box3().setFromObject(object);
    const dimensions = finalBox.getSize(new THREE.Vector3());
    const center = finalBox.getCenter(new THREE.Vector3());
    const stats = collectModelStats(object);
    floor.position.y = finalBox.min.y - Math.max(0.16, dimensions.y * 0.08);
    grid.position.y = floor.position.y + 0.01;

    modelInfo = {
      ...metadata,
      dimensions,
      center,
      sourceCenter,
      scale,
      meshCount: stats.meshCount,
      triangleCount: stats.triangleCount,
      materialCount: stats.materialCount,
      animationCount: clips.length,
      animations: clips.map((clip, index) => ({ index, name: clip.name || `Animation ${index + 1}` })),
      currentAnimation: currentAnimationIndex >= 0 ? clips[currentAnimationIndex]?.name || `Animation ${currentAnimationIndex + 1}` : "NONE",
      mixerState: mixer ? (playing ? "PLAYING" : "PAUSED") : "NONE",
      warning: stats.triangleCount >= HEAVY_TRIANGLE_THRESHOLD
        ? "このモデルはモバイル端末では重い可能性があります"
        : "",
      lightingPreset,
      backgroundPreset,
    };
    return modelInfo;
  }

  async function loadFile(file) {
    const startedAt = performance.now();
    if (!file || !file.name?.toLowerCase().endsWith(".glb")) {
      const error = new Error("GLB_FILE_REQUIRED");
      Object.assign(modelInfo, { loaderState: "OBJECT LOAD ERROR", errorCode: error.message, errorDetail: "GLBファイルを選択してください。" });
      emitUpdate();
      throw error;
    }
    if (!file.size) {
      const error = new Error("EMPTY_FILE");
      Object.assign(modelInfo, { loaderState: "OBJECT LOAD ERROR", errorCode: error.message, errorDetail: "ファイルが空です。" });
      emitUpdate();
      throw error;
    }

    Object.assign(modelInfo, { loaderState: "LOADING OBJECT...", errorCode: "", errorDetail: "", warning: "" });
    emitUpdate();
    const requestId = ++loadRequestId;
    try {
      const buffer = await file.arrayBuffer();
      return await parseAndAdopt(buffer, file.name, startedAt, requestId);
    } catch (error) {
      const detail = friendlyLoadError(error);
      if (!disposed && requestId === loadRequestId) {
        Object.assign(modelInfo, {
          loaderState: "OBJECT LOAD ERROR",
          errorCode: error?.message || "GLB_PARSE_ERROR",
          errorDetail: detail,
          loadTime: performance.now() - startedAt,
        });
        emitUpdate();
      }
      throw error;
    }
  }

  async function parseAndAdopt(buffer, name, startedAt, requestId) {
    const header = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 4));
    if (header.length < 4 || String.fromCharCode(...header) !== "glTF") throw new Error("INVALID_GLB_HEADER");
    assertSelfContainedGlb(buffer);
    const loader = new GLTFLoader();
    const gltf = await loader.parseAsync(buffer, "");
    if (!gltf?.scene) throw new Error("EMPTY_MODEL");

    const nextContent = gltf.scene;
    const nextClips = Array.isArray(gltf.animations) ? gltf.animations : [];
    const nextStats = collectModelStats(nextContent);
    if (!nextStats.meshCount) {
      disposeModelContent(nextContent);
      throw new Error("EMPTY_MODEL");
    }
    if (disposed || requestId !== loadRequestId) {
      disposeModelContent(nextContent);
      return getInfo();
    }

    nextContent.traverse((object) => {
      if (!object.isMesh) return;
      object.castShadow = true;
      object.receiveShadow = true;
    });

    const previousClips = clips;
    clips = nextClips;
    try {
      frameContent(nextContent, {
        name,
        loaded: true,
        loadTime: performance.now() - startedAt,
        loaderState: "OBJECT READY",
      });
    } catch (error) {
      clips = previousClips;
      disposeModelContent(nextContent);
      throw error;
    }

    clearAnimation();
    disposeModelContent(content);
    modelRoot.remove(content);
    content = nextContent;
    modelRoot.add(content);
    clips = nextClips;
    setupAnimation();
    modelInfo.loadTime = performance.now() - startedAt;
    modelInfo.loaderState = "OBJECT READY";
    modelInfo.errorCode = "";
    modelInfo.errorDetail = "";
    emitUpdate();
    return getInfo();
  }

  function setupAnimation() {
    if (!clips.length) return;
    mixer = new THREE.AnimationMixer(content);
    setAnimation(0);
    if (reducedMotion) setPlaying(false);
  }

  function clearAnimation() {
    if (!mixer) return;
    mixer.stopAllAction();
    mixer.uncacheRoot(content);
    mixer = null;
    currentAction = null;
    currentAnimationIndex = -1;
    playing = false;
  }

  function setAnimation(index) {
    if (!mixer || !clips.length) return false;
    const nextIndex = Math.min(clips.length - 1, Math.max(0, Number(index) || 0));
    currentAction?.fadeOut(0.12);
    currentAnimationIndex = nextIndex;
    currentAction = mixer.clipAction(clips[nextIndex]);
    currentAction.reset().fadeIn(0.12).play();
    playing = true;
    updateAnimationInfo();
    emitUpdate();
    return true;
  }

  function setPlaying(value) {
    if (!mixer || !currentAction) return false;
    playing = Boolean(value);
    currentAction.paused = !playing;
    updateAnimationInfo();
    emitUpdate();
    return true;
  }

  function updateAnimationInfo() {
    modelInfo.animationCount = clips.length;
    modelInfo.animations = clips.map((clip, index) => ({ index, name: clip.name || `Animation ${index + 1}` }));
    modelInfo.currentAnimation = currentAnimationIndex >= 0
      ? clips[currentAnimationIndex]?.name || `Animation ${currentAnimationIndex + 1}`
      : "NONE";
    modelInfo.mixerState = mixer ? (playing ? "PLAYING" : "PAUSED") : "NONE";
  }

  function applyLightingPreset(preset) {
    lightingPreset = ["studio", "soft", "dramatic"].includes(preset) ? preset : "studio";
    lightRig.clear();
    if (lightingPreset === "soft") {
      lightRig.add(new THREE.HemisphereLight(0xf0f7ff, 0x344054, 2.4));
      const key = new THREE.DirectionalLight(0xffffff, 2.25);
      key.position.set(3, 5, 5);
      key.castShadow = true;
      lightRig.add(key);
    } else if (lightingPreset === "dramatic") {
      lightRig.add(new THREE.HemisphereLight(0x56718e, 0x08090d, 0.72));
      const key = new THREE.DirectionalLight(0x9effef, 4.6);
      key.position.set(-4, 5, 4);
      key.castShadow = true;
      const rim = new THREE.DirectionalLight(0xa389ff, 3.1);
      rim.position.set(4, 1, -3);
      lightRig.add(key, rim);
    } else {
      lightRig.add(new THREE.HemisphereLight(0xd9efff, 0x111827, 1.55));
      const key = new THREE.DirectionalLight(0xffffff, 3.1);
      key.position.set(3.8, 5.5, 4.8);
      key.castShadow = true;
      key.shadow.mapSize.set(512, 512);
      const fill = new THREE.DirectionalLight(0x87dfff, 1.65);
      fill.position.set(-4, 1.5, 3);
      const rim = new THREE.DirectionalLight(0xa890ff, 1.35);
      rim.position.set(1, 3, -4);
      lightRig.add(key, fill, rim);
    }
    modelInfo.lightingPreset = lightingPreset;
    emitUpdate();
  }

  function applyBackgroundPreset(preset) {
    backgroundPreset = ["dark", "light", "grid"].includes(preset) ? preset : "dark";
    const light = backgroundPreset === "light";
    backdrop.material.color.setHex(light ? 0xb9c4cf : backgroundPreset === "grid" ? 0x09111d : 0x080d17);
    floor.material.color.setHex(light ? 0x9da9b5 : 0x101827);
    grid.visible = backgroundPreset === "grid";
    floor.visible = backgroundPreset !== "dark";
    modelInfo.backgroundPreset = backgroundPreset;
    emitUpdate();
  }

  function getCameraSettings(fov, aspect) {
    const dimensions = modelInfo.dimensions ?? new THREE.Vector3(TARGET_MODEL_SIZE, TARGET_MODEL_SIZE, TARGET_MODEL_SIZE);
    const verticalFov = THREE.MathUtils.degToRad(fov);
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * Math.max(aspect, 0.1));
    const distanceForHeight = (dimensions.y * 0.5) / Math.tan(verticalFov * 0.5);
    const distanceForWidth = (dimensions.x * 0.5) / Math.tan(horizontalFov * 0.5);
    const distance = Math.max(distanceForHeight, distanceForWidth) * 1.36 + dimensions.z * 0.5;
    const maxDimension = Math.max(dimensions.x, dimensions.y, dimensions.z);
    const target = modelInfo.center?.clone?.() ?? new THREE.Vector3();
    const near = Math.max(0.01, distance / 120);
    const far = Math.max(40, distance + maxDimension * 12);
    modelInfo.baseCameraDistance = distance;
    return {
      distance,
      target,
      rangeX: maxDimension * 0.34,
      rangeY: maxDimension * 0.27,
      near,
      far,
    };
  }

  function update(time) {
    const delta = lastTime ? Math.min((time - lastTime) / 1000, 0.1) : 0;
    lastTime = time;
    if (mixer && playing && !reducedMotion) mixer.update(delta);
  }

  function getInfo() {
    updateAnimationInfo();
    return {
      ...modelInfo,
      dimensions: vectorToObject(modelInfo.dimensions),
      center: vectorToObject(modelInfo.center),
      sourceCenter: vectorToObject(modelInfo.sourceCenter),
      target: vectorToObject(modelInfo.center),
      lightingPreset,
      backgroundPreset,
    };
  }

  function dispose() {
    disposed = true;
    loadRequestId += 1;
    clearAnimation();
  }

  return {
    root,
    config: {
      label: "OBJECT",
      background: 0x080d17,
      fog: null,
      shadows: true,
      cameraRange: 1,
    },
    update,
    loadFile,
    setAnimation,
    setPlaying,
    setLightingPreset: applyLightingPreset,
    setBackgroundPreset: applyBackgroundPreset,
    getCameraSettings,
    getModelInfo: getInfo,
    dispose,
  };
}

function createPlaceholderModel(THREE) {
  const group = new THREE.Group();
  group.name = "PLACEHOLDER_MODEL";
  const metal = new THREE.MeshStandardMaterial({ color: 0x8ee8dc, roughness: 0.24, metalness: 0.62 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x172437, roughness: 0.38, metalness: 0.52 });
  const accent = new THREE.MeshStandardMaterial({ color: 0xa68cff, emissive: 0x2b1859, emissiveIntensity: 0.75, roughness: 0.25, metalness: 0.45 });

  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(1.12, 1), metal);
  body.scale.set(0.88, 1.08, 0.72);
  group.add(body);
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.48, 0), accent);
  core.position.set(0.28, 0.08, 0.82);
  group.add(core);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.23, 0.075, 10, 72), dark);
  ring.rotation.set(Math.PI / 2.9, 0.2, 0.28);
  group.add(ring);
  [-1, 1].forEach((side) => {
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.38, 1.4, 5), side > 0 ? accent : dark);
    fin.position.set(side * 1.18, -0.18, -0.16);
    fin.rotation.z = side * -Math.PI / 2.35;
    group.add(fin);
  });
  const hiddenOrb = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 16), accent);
  hiddenOrb.position.set(-0.55, 0.5, -0.82);
  hiddenOrb.name = "HIDDEN_DETAIL";
  group.add(hiddenOrb);
  group.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
  });
  return group;
}

function collectModelStats(root) {
  let meshCount = 0;
  let triangleCount = 0;
  const materials = new Set();
  root.traverse((object) => {
    if (!object.isMesh) return;
    meshCount += 1;
    const geometry = object.geometry;
    if (geometry) {
      const baseTriangles = geometry.index
        ? geometry.index.count / 3
        : (geometry.attributes.position?.count ?? 0) / 3;
      triangleCount += baseTriangles * (object.isInstancedMesh ? object.count : 1);
    }
    const meshMaterials = Array.isArray(object.material) ? object.material : [object.material];
    meshMaterials.filter(Boolean).forEach((material) => materials.add(material));
  });
  return { meshCount, triangleCount: Math.round(triangleCount), materialCount: materials.size };
}

function disposeModelContent(root) {
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  root?.traverse((object) => {
    if (object.geometry && !geometries.has(object.geometry)) {
      geometries.add(object.geometry);
      object.geometry.dispose();
    }
    const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
    objectMaterials.filter(Boolean).forEach((material) => {
      if (materials.has(material)) return;
      materials.add(material);
      Object.values(material).forEach((value) => {
        if (value?.isTexture && !textures.has(value)) {
          textures.add(value);
          value.dispose();
        }
      });
      material.dispose();
    });
  });
}

function friendlyLoadError(error) {
  if (error?.message === "GLB_FILE_REQUIRED") return "GLBファイルを選択してください。";
  if (error?.message === "EMPTY_FILE") return "ファイルが空です。";
  if (error?.message === "INVALID_GLB_HEADER") return "GLB形式を確認できませんでした。";
  if (error?.message === "EXTERNAL_RESOURCE_UNSUPPORTED") return "外部ファイル参照のない単一GLBを選択してください。";
  if (error?.message === "EMPTY_MODEL") return "表示できるMeshがモデル内にありません。";
  return "モデルを読み込めませんでした。別の非圧縮GLBをお試しください。";
}

function assertSelfContainedGlb(buffer) {
  if (buffer.byteLength < 20) throw new Error("INVALID_GLB_HEADER");
  const view = new DataView(buffer);
  const jsonLength = view.getUint32(12, true);
  const jsonType = view.getUint32(16, true);
  if (jsonType !== 0x4e4f534a || 20 + jsonLength > buffer.byteLength) throw new Error("INVALID_GLB_HEADER");
  let json;
  try {
    json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, jsonLength)).replace(/[\u0000\u0020]+$/g, ""));
  } catch {
    throw new Error("GLB_PARSE_ERROR");
  }
  const uris = [...(json.buffers ?? []), ...(json.images ?? [])]
    .map((resource) => resource?.uri)
    .filter(Boolean);
  if (uris.some((uri) => !String(uri).startsWith("data:"))) throw new Error("EXTERNAL_RESOURCE_UNSUPPORTED");
}

function vectorToObject(vector) {
  return vector ? { x: vector.x, y: vector.y, z: vector.z } : { x: 0, y: 0, z: 0 };
}

function createEmptyInfo() {
  return {
    loaded: false,
    name: "TILT OBJECT",
    loaderState: "OBJECT READY",
    dimensions: null,
    center: null,
    sourceCenter: null,
    scale: 1,
    baseCameraDistance: 7.5,
    meshCount: 0,
    triangleCount: 0,
    materialCount: 0,
    animationCount: 0,
    animations: [],
    currentAnimation: "NONE",
    mixerState: "NONE",
    loadTime: 0,
    warning: "",
    errorCode: "",
    errorDetail: "",
  };
}
