export function createCrystalScene(THREE, { reducedMotion = false } = {}) {
  const root = new THREE.Group();
  root.name = "BUBBLE / CRYSTAL";
  const animationScale = reducedMotion ? 0.2 : 1;

  root.add(new THREE.HemisphereLight(0xc5d9ff, 0x120d27, 1.35));
  const key = new THREE.DirectionalLight(0xe7f7ff, 2.35);
  key.position.set(-3.5, 5.2, 4.5);
  key.castShadow = true;
  key.shadow.mapSize.set(512, 512);
  root.add(key);
  const violet = new THREE.PointLight(0x9b78ff, 21, 10, 2);
  violet.position.set(-2.2, 1, 2.5);
  root.add(violet);
  const cyan = new THREE.PointLight(0x69ffe9, 17, 9, 2);
  cyan.position.set(2.4, -1.1, 2);
  root.add(cyan);

  const backdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(11, 8),
    new THREE.MeshStandardMaterial({ color: 0x0e0b22, roughness: 0.88 }),
  );
  backdrop.position.set(0, 0.15, -5.3);
  root.add(backdrop);

  const central = createCentralCrystal(THREE);
  root.add(central.group);
  const satellites = createSatellites(THREE);
  satellites.items.forEach((item) => root.add(item));
  const bubbles = createGlassBubbles(THREE);
  bubbles.forEach((bubble) => root.add(bubble));
  const background = createBackgroundLights(THREE);
  background.forEach((item) => root.add(item));

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(4.5, 50),
    new THREE.MeshStandardMaterial({ color: 0x120e28, roughness: 0.35, metalness: 0.45, transparent: true, opacity: 0.75 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -2.35, -0.5);
  floor.receiveShadow = true;
  root.add(floor);

  return {
    root,
    config: {
      id: "crystal",
      label: "BUBBLE / CRYSTAL",
      background: 0x080615,
      fog: { type: "exp2", color: 0x100b25, density: 0.052 },
      cameraRange: 0.92,
      fov: 42,
      shadows: true,
    },
    update(time) {
      const seconds = time * 0.001;
      central.group.rotation.y = central.baseY + seconds * 0.035 * animationScale;
      central.group.rotation.x = central.baseX + Math.sin(seconds * 0.18) * 0.025 * animationScale;
      central.inner.material.emissiveIntensity = 0.7 + Math.sin(seconds * 0.8) * 0.12 * animationScale;
      satellites.items.forEach((item, index) => {
        item.rotation.y = item.userData.baseRY + seconds * (0.035 + index * 0.006) * animationScale;
        item.position.y = item.userData.baseY + Math.sin(seconds * 0.32 + index * 1.3) * 0.065 * animationScale;
      });
      bubbles.forEach((bubble, index) => {
        bubble.position.y = bubble.userData.baseY + Math.sin(seconds * 0.2 + index * 1.8) * 0.08 * animationScale;
      });
    },
  };
}

function createCentralCrystal(THREE) {
  const group = new THREE.Group();
  group.position.set(0, -0.05, -0.2);
  group.rotation.set(0.13, 0.22, -0.08);
  const shell = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.35, 1),
    new THREE.MeshPhysicalMaterial({
      color: 0x9edcff,
      transparent: true,
      opacity: 0.44,
      roughness: 0.08,
      metalness: 0.06,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  shell.renderOrder = 4;
  group.add(shell);
  const inner = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.72, 0),
    new THREE.MeshStandardMaterial({ color: 0xb8fff5, emissive: 0x4b83a8, emissiveIntensity: 0.7, roughness: 0.22, metalness: 0.38 }),
  );
  inner.castShadow = true;
  group.add(inner);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.62, 0.035, 8, 60),
    new THREE.MeshBasicMaterial({ color: 0x9b83ff, transparent: true, opacity: 0.55 }),
  );
  ring.rotation.x = Math.PI / 2.5;
  group.add(ring);
  return { group, inner, baseX: group.rotation.x, baseY: group.rotation.y };
}

function createSatellites(THREE) {
  const specs = [
    [-1.72, 1.05, -1.8, 0.48, 0x8d7bff], [1.62, 0.8, -1.2, 0.38, 0x75ffe5],
    [-1.55, -1.25, 0.55, 0.55, 0x86c8ff], [1.75, -1.05, 0.85, 0.46, 0xd2a1ff],
    [0.65, 1.65, -2.7, 0.3, 0x8ef6ff], [-0.55, -1.7, -2.25, 0.34, 0xb79aff],
  ];
  const items = specs.map(([x,y,z,size,color], index) => {
    const geometry = index % 2 ? new THREE.OctahedronGeometry(size, 0) : new THREE.IcosahedronGeometry(size, 0);
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.22, roughness: 0.18, metalness: 0.45 }));
    mesh.position.set(x,y,z);
    mesh.rotation.set(index * .2, index * .4, index * .13);
    mesh.castShadow = true;
    mesh.userData.baseY = y;
    mesh.userData.baseRY = mesh.rotation.y;
    return mesh;
  });
  return { items };
}

function createGlassBubbles(THREE) {
  const specs = [[-2.45,.45,2.5,.92],[2.45,-.15,2.25,.76],[-1.9,-1.75,1.55,.5],[1.55,1.55,.55,.42]];
  return specs.map(([x,y,z,size], index) => {
    const bubble = new THREE.Mesh(
      new THREE.SphereGeometry(size, 28, 18),
      new THREE.MeshPhysicalMaterial({ color: index % 2 ? 0xb99dff : 0x9ffff0, transparent: true, opacity: 0.2, roughness: 0.04, metalness: 0, depthWrite: false, side: THREE.DoubleSide }),
    );
    bubble.position.set(x,y,z);
    bubble.renderOrder = 6 + index;
    bubble.userData.baseY = y;
    return bubble;
  });
}

function createBackgroundLights(THREE) {
  const specs = [[-2.2,1.7,-3.8,.16,0x8d7bff],[2.15,1.15,-3.4,.2,0x68ffe5],[-1.45,-.45,-4,.12,0x76d8ff],[1.15,-1.35,-3.2,.18,0xcf91ff],[0,.15,-4.6,.22,0xffffff]];
  return specs.map(([x,y,z,size,color]) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(size,12,8), new THREE.MeshBasicMaterial({ color }));
    mesh.position.set(x,y,z);
    return mesh;
  });
}
