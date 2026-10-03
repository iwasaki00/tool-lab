const THREE_VERSION = "0.170.0";
const THREE_MODULE_URL = "./three.module.js";
const CAMERA_Z = 7.5;
const CAMERA_RANGE_X = 1.35;
const CAMERA_RANGE_Y = 1.0;
const FOV = 42;

export { THREE_VERSION };

export async function createScene3D({ canvas, container, onStatus = () => {} }) {
  let THREE;
  try {
    THREE = await import(THREE_MODULE_URL);
  } catch (error) {
    onStatus({ available: false, message: "Three.jsを読み込めませんでした" });
    return createUnavailableScene(error);
  }

  let webglRenderer;
  try {
    webglRenderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
  } catch (error) {
    onStatus({ available: false, message: "WebGLを利用できません" });
    return createUnavailableScene(error);
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050914);
  scene.fog = new THREE.Fog(0x050914, 7.5, 18);

  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 40);
  camera.position.set(0, 0, CAMERA_Z);
  const focalTarget = new THREE.Vector3(0, -0.05, -0.55);
  camera.lookAt(focalTarget);

  const effectivePixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  webglRenderer.setPixelRatio(effectivePixelRatio);
  webglRenderer.outputColorSpace = THREE.SRGBColorSpace;
  webglRenderer.shadowMap.enabled = true;
  webglRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
  webglRenderer.toneMapping = THREE.ACESFilmicToneMapping;
  webglRenderer.toneMappingExposure = 1.05;

  const world = new THREE.Group();
  scene.add(world);

  const hemisphere = new THREE.HemisphereLight(0x9eeeff, 0x111326, 1.25);
  scene.add(hemisphere);
  const keyLight = new THREE.DirectionalLight(0xd9ffff, 2.8);
  keyLight.position.set(-3.5, 5, 6);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(512, 512);
  keyLight.shadow.camera.near = 1;
  keyLight.shadow.camera.far = 18;
  keyLight.shadow.camera.left = -5;
  keyLight.shadow.camera.right = 5;
  keyLight.shadow.camera.top = 5;
  keyLight.shadow.camera.bottom = -5;
  scene.add(keyLight);
  const cyanLight = new THREE.PointLight(0x53ffe1, 18, 9, 2);
  cyanLight.position.set(2.6, 1.1, 2.8);
  scene.add(cyanLight);
  const violetLight = new THREE.PointLight(0x8874ff, 13, 8, 2);
  violetLight.position.set(-2.7, -1.3, 1.6);
  scene.add(violetLight);

  const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x0a1320, roughness: 0.68, metalness: 0.25 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 18), floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -2.25, -2.4);
  floor.receiveShadow = true;
  world.add(floor);

  const grid = new THREE.GridHelper(12, 22, 0x2bdac5, 0x183c49);
  grid.position.set(0, -2.235, -2.1);
  grid.material.transparent = true;
  grid.material.opacity = 0.34;
  world.add(grid);

  const backWall = createBackWall(THREE);
  world.add(backWall);
  const corridor = createCorridor(THREE);
  world.add(corridor);

  const hiddenObjects = createHiddenObjects(THREE);
  world.add(hiddenObjects.group);
  const mainObject = createMainObject(THREE);
  world.add(mainObject);
  const foreground = createForegroundObjects(THREE);
  world.add(foreground.group);

  const axes = new THREE.AxesHelper(2.2);
  axes.position.set(0, -2.15, 0.2);
  axes.visible = false;
  scene.add(axes);

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let debugVisible = false;
  let paused = false;
  let width = 1;
  let height = 1;
  let lastCamera = { x: 0, y: 0, z: CAMERA_Z };

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

  function render({ cameraViewX = 0, cameraViewY = 0, time = 0 } = {}) {
    if (paused) return;
    resize();
    camera.position.x = cameraViewX * CAMERA_RANGE_X;
    camera.position.y = cameraViewY * CAMERA_RANGE_Y;
    camera.position.z = CAMERA_Z;
    camera.lookAt(focalTarget);
    lastCamera = { x: camera.position.x, y: camera.position.y, z: camera.position.z };

    const animationScale = reduceMotion ? 0.22 : 1;
    foreground.items.forEach((item, index) => {
      item.position.y = item.userData.baseY + Math.sin(time * 0.00045 + index * 1.7) * 0.09 * animationScale;
      item.rotation.x = item.userData.baseRotationX + Math.sin(time * 0.00025 + index) * 0.07 * animationScale;
      item.rotation.y = item.userData.baseRotationY + time * 0.00008 * animationScale * (index % 2 ? -1 : 1);
    });
    hiddenObjects.beacon.material.emissiveIntensity = 1.15 + Math.sin(time * 0.0014) * 0.18 * animationScale;
    webglRenderer.render(scene, camera);
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  resize();
  render();
  onStatus({ available: true, message: `Three.js ${THREE_VERSION}` });

  return {
    available: true,
    version: THREE_VERSION,
    render,
    resize,
    setPaused(value) { paused = Boolean(value); },
    setDebugVisible(value) { debugVisible = Boolean(value); axes.visible = debugVisible; },
    getMetrics() {
      return {
        available: true,
        camera: { ...lastCamera },
        fov: camera.fov,
        width,
        height,
        devicePixelRatio: window.devicePixelRatio || 1,
        effectivePixelRatio,
      };
    },
    dispose() {
      resizeObserver.disconnect();
      webglRenderer.dispose();
    },
  };
}

function createMainObject(THREE) {
  const group = new THREE.Group();
  group.position.set(0, -0.05, -0.15);

  const shellMaterials = [
    new THREE.MeshStandardMaterial({ color: 0x1b8c91, roughness: 0.24, metalness: 0.72 }),
    new THREE.MeshStandardMaterial({ color: 0x735fbd, roughness: 0.28, metalness: 0.68 }),
    new THREE.MeshStandardMaterial({ color: 0x27485a, roughness: 0.2, metalness: 0.78 }),
    new THREE.MeshStandardMaterial({ color: 0x101b2d, roughness: 0.48, metalness: 0.5 }),
    new THREE.MeshStandardMaterial({ color: 0x173747, roughness: 0.32, metalness: 0.72 }),
    new THREE.MeshStandardMaterial({ color: 0x0d1625, roughness: 0.5, metalness: 0.45 }),
  ];
  const shell = new THREE.Mesh(new THREE.BoxGeometry(2.15, 2.72, 1.18, 3, 3, 2), shellMaterials);
  shell.castShadow = true;
  shell.receiveShadow = true;
  group.add(shell);

  const face = new THREE.Mesh(
    new THREE.BoxGeometry(1.58, 1.68, 0.13),
    new THREE.MeshStandardMaterial({ color: 0x07121d, emissive: 0x092a31, emissiveIntensity: 0.7, roughness: 0.23, metalness: 0.72 }),
  );
  face.position.set(0, 0.05, 0.655);
  face.castShadow = true;
  group.add(face);

  const core = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.51, 1),
    new THREE.MeshStandardMaterial({ color: 0x7fffea, emissive: 0x19b8aa, emissiveIntensity: 1.4, roughness: 0.18, metalness: 0.42 }),
  );
  core.position.set(0, 0.08, 0.82);
  group.add(core);

  const railMaterial = new THREE.MeshStandardMaterial({ color: 0xa9fff2, emissive: 0x1c9b92, emissiveIntensity: 0.55, metalness: 0.8, roughness: 0.2 });
  [-1, 1].forEach((side) => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.25, 0.08), railMaterial);
    rail.position.set(side * 0.88, 0, 0.75);
    group.add(rail);
  });
  return group;
}

function createHiddenObjects(THREE) {
  const group = new THREE.Group();
  const cyanMaterial = new THREE.MeshStandardMaterial({ color: 0x35e9d0, emissive: 0x0c8d82, emissiveIntensity: 1.15, roughness: 0.25, metalness: 0.48 });
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 16), cyanMaterial);
  beacon.position.set(0.72, 0.18, -1.55);
  group.add(beacon);
  const violet = new THREE.Mesh(new THREE.IcosahedronGeometry(0.47, 1), new THREE.MeshStandardMaterial({ color: 0xa08cff, emissive: 0x3d2a95, emissiveIntensity: 0.7, roughness: 0.33, metalness: 0.5 }));
  violet.position.set(-0.78, -0.48, -1.8);
  group.add(violet);
  const backColumnMaterial = new THREE.MeshStandardMaterial({ color: 0x132a3a, roughness: 0.55, metalness: 0.38 });
  [-2.45, 2.45].forEach((x) => {
    const column = new THREE.Mesh(new THREE.BoxGeometry(0.42, 4.6, 0.7), backColumnMaterial);
    column.position.set(x, 0, -2.8);
    column.castShadow = true;
    group.add(column);
  });
  return { group, beacon };
}

function createForegroundObjects(THREE) {
  const group = new THREE.Group();
  const specs = [
    { geometry: new THREE.IcosahedronGeometry(0.24, 1), position: [-1.55, 0.95, 1.55], color: 0x7fffea },
    { geometry: new THREE.SphereGeometry(0.19, 20, 14), position: [1.6, 0.18, 1.2], color: 0x9a89ff },
    { geometry: new THREE.BoxGeometry(0.34, 0.34, 0.34), position: [-1.45, -1.15, 1.72], color: 0x57d9ec },
    { geometry: new THREE.TetrahedronGeometry(0.25, 0), position: [1.35, -1.2, 1.45], color: 0xd1c9ff },
  ];
  const items = specs.map((spec, index) => {
    const material = new THREE.MeshStandardMaterial({ color: spec.color, emissive: spec.color, emissiveIntensity: 0.3, roughness: 0.26, metalness: 0.58 });
    const mesh = new THREE.Mesh(spec.geometry, material);
    mesh.position.set(...spec.position);
    mesh.rotation.set(index * 0.28, index * 0.5, index * 0.17);
    mesh.userData.baseY = mesh.position.y;
    mesh.userData.baseRotationX = mesh.rotation.x;
    mesh.userData.baseRotationY = mesh.rotation.y;
    mesh.castShadow = true;
    group.add(mesh);
    return mesh;
  });
  return { group, items };
}

function createBackWall(THREE) {
  const group = new THREE.Group();
  group.position.z = -5.2;
  const panelMaterial = new THREE.MeshStandardMaterial({ color: 0x08121e, roughness: 0.8, metalness: 0.15 });
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(11, 8), panelMaterial);
  wall.position.y = 0.4;
  group.add(wall);
  const ringMaterial = new THREE.MeshBasicMaterial({ color: 0x2fe9d2, transparent: true, opacity: 0.24, side: THREE.DoubleSide });
  [1.45, 2.25, 3.05].forEach((radius) => {
    const ring = new THREE.Mesh(new THREE.RingGeometry(radius, radius + 0.018, 80), ringMaterial);
    ring.position.set(0, 0.2, 0.025);
    group.add(ring);
  });
  return group;
}

function createCorridor(THREE) {
  const group = new THREE.Group();
  const material = new THREE.LineBasicMaterial({ color: 0x2e817f, transparent: true, opacity: 0.34 });
  [-4.5, -3.2, -1.8, -0.5, 0.8].forEach((z, index) => {
    const geometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(6.4 - index * 0.18, 5.1 - index * 0.12, 0.04));
    const frame = new THREE.LineSegments(geometry, material);
    frame.position.set(0, 0.15, z);
    group.add(frame);
  });
  return group;
}

function createUnavailableScene(error) {
  return {
    available: false,
    version: THREE_VERSION,
    error,
    render() {}, resize() {}, setPaused() {}, setDebugVisible() {}, dispose() {},
    getMetrics() {
      return { available: false, camera: { x: 0, y: 0, z: CAMERA_Z }, fov: FOV, width: 0, height: 0, devicePixelRatio: window.devicePixelRatio || 1, effectivePixelRatio: 0 };
    },
  };
}
