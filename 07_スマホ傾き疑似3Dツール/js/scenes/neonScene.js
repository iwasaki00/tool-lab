export function createNeonScene(THREE, { reducedMotion = false } = {}) {
  const root = new THREE.Group();
  root.name = "NEON CHAMBER";
  const animationScale = reducedMotion ? 0.2 : 1;

  root.add(new THREE.HemisphereLight(0x9eeeff, 0x101025, 1.2));
  const key = new THREE.DirectionalLight(0xe5ffff, 2.5);
  key.position.set(-3.5, 5, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(512, 512);
  root.add(key);
  const cyan = new THREE.PointLight(0x43ffe0, 19, 10, 2);
  cyan.position.set(2.6, 1.1, 2.8);
  root.add(cyan);
  const violet = new THREE.PointLight(0x8b73ff, 15, 9, 2);
  violet.position.set(-2.7, -1.1, 1.7);
  root.add(violet);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 18),
    new THREE.MeshStandardMaterial({ color: 0x08111d, roughness: 0.65, metalness: 0.28 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -2.3, -2.3);
  floor.receiveShadow = true;
  root.add(floor);
  const grid = new THREE.GridHelper(12, 24, 0x33e9d2, 0x173946);
  grid.position.set(0, -2.285, -2.1);
  grid.material.transparent = true;
  grid.material.opacity = 0.36;
  root.add(grid);

  const wall = new THREE.Mesh(new THREE.PlaneGeometry(11, 8), new THREE.MeshStandardMaterial({ color: 0x07101d, roughness: 0.85 }));
  wall.position.set(0, 0.3, -5.4);
  root.add(wall);
  const corridor = createCorridor(THREE);
  root.add(corridor);

  const exhibit = createExhibit(THREE);
  root.add(exhibit.group);
  const hidden = createHiddenObjects(THREE);
  root.add(hidden.group);
  const foreground = createForeground(THREE);
  root.add(foreground.group);

  return {
    root,
    config: {
      id: "neon",
      label: "NEON CHAMBER",
      background: 0x050914,
      fog: { type: "linear", color: 0x050914, near: 8, far: 19 },
      cameraRange: 1.1,
      fov: 42,
      shadows: true,
    },
    update(time) {
      const seconds = time * 0.001;
      exhibit.rings.forEach((ring, index) => {
        ring.rotation.z = ring.userData.baseZ + seconds * 0.055 * animationScale * (index ? -1 : 1);
        ring.rotation.y = ring.userData.baseY + Math.sin(seconds * 0.16 + index) * 0.08 * animationScale;
      });
      exhibit.core.material.emissiveIntensity = 1.25 + Math.sin(seconds * 1.1) * 0.16 * animationScale;
      foreground.items.forEach((item, index) => {
        item.position.y = item.userData.baseY + Math.sin(seconds * 0.35 + index * 1.8) * 0.07 * animationScale;
        item.rotation.y = item.userData.baseRY + seconds * 0.06 * animationScale * (index % 2 ? -1 : 1);
      });
      hidden.beacon.material.emissiveIntensity = 1.1 + Math.sin(seconds * 1.4) * 0.2 * animationScale;
    },
  };
}

function createExhibit(THREE) {
  const group = new THREE.Group();
  group.position.set(0, -0.05, -0.25);
  const pedestal = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 2.45, 1.12),
    new THREE.MeshStandardMaterial({ color: 0x10293a, roughness: 0.25, metalness: 0.72 }),
  );
  pedestal.castShadow = true;
  group.add(pedestal);
  const core = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.52, 1),
    new THREE.MeshStandardMaterial({ color: 0x74ffe7, emissive: 0x18a99c, emissiveIntensity: 1.25, roughness: 0.17, metalness: 0.46 }),
  );
  core.position.z = 0.78;
  group.add(core);
  const rings = [
    new THREE.Mesh(new THREE.TorusGeometry(0.88, 0.055, 10, 50), new THREE.MeshStandardMaterial({ color: 0x7fffea, emissive: 0x188b83, emissiveIntensity: 0.75, metalness: 0.7, roughness: 0.2 })),
    new THREE.Mesh(new THREE.TorusGeometry(1.16, 0.035, 8, 52), new THREE.MeshStandardMaterial({ color: 0x9b89ff, emissive: 0x4136a2, emissiveIntensity: 0.65, metalness: 0.65, roughness: 0.22 })),
  ];
  rings[0].rotation.set(Math.PI / 2.7, 0.2, 0.15);
  rings[1].rotation.set(0.35, Math.PI / 2.4, -0.3);
  rings.forEach((ring) => {
    ring.position.z = 0.25;
    ring.userData.baseZ = ring.rotation.z;
    ring.userData.baseY = ring.rotation.y;
    group.add(ring);
  });
  const rearCylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.34, 2.9, 16),
    new THREE.MeshStandardMaterial({ color: 0x54499a, emissive: 0x231d68, emissiveIntensity: 0.45, metalness: 0.72, roughness: 0.25 }),
  );
  rearCylinder.rotation.z = Math.PI / 2;
  rearCylinder.position.set(0.45, 0.2, -1.05);
  group.add(rearCylinder);
  return { group, core, rings };
}

function createHiddenObjects(THREE) {
  const group = new THREE.Group();
  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.46, 22, 15),
    new THREE.MeshStandardMaterial({ color: 0xff74c7, emissive: 0xb31974, emissiveIntensity: 1.1, roughness: 0.24 }),
  );
  beacon.position.set(0.84, 0.52, -1.65);
  group.add(beacon);
  const cube = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), new THREE.MeshStandardMaterial({ color: 0x4ed5e6, emissive: 0x0b6670, emissiveIntensity: 0.55, metalness: 0.55, roughness: 0.3 }));
  cube.position.set(-0.82, -0.65, -1.9);
  cube.rotation.set(0.25, 0.45, 0.2);
  group.add(cube);
  return { group, beacon };
}

function createForeground(THREE) {
  const group = new THREE.Group();
  const specs = [
    { geometry: new THREE.IcosahedronGeometry(0.55, 1), position: [-2.6, 1.0, 2.45], color: 0x7fffea },
    { geometry: new THREE.SphereGeometry(0.43, 20, 14), position: [2.55, 0.05, 2.2], color: 0x9b89ff },
    { geometry: new THREE.BoxGeometry(0.62, 0.62, 0.62), position: [-2.2, -1.55, 2.15], color: 0x45c7dc },
    { geometry: new THREE.TetrahedronGeometry(0.5, 0), position: [2.25, -1.42, 2.35], color: 0xd7ceff },
  ];
  const items = specs.map((spec, index) => {
    const mesh = new THREE.Mesh(spec.geometry, new THREE.MeshStandardMaterial({ color: spec.color, emissive: spec.color, emissiveIntensity: 0.22, metalness: 0.6, roughness: 0.25 }));
    mesh.position.set(...spec.position);
    mesh.rotation.set(index * 0.3, index * 0.48, index * 0.16);
    mesh.castShadow = true;
    mesh.userData.baseY = mesh.position.y;
    mesh.userData.baseRY = mesh.rotation.y;
    group.add(mesh);
    return mesh;
  });
  return { group, items };
}

function createCorridor(THREE) {
  const group = new THREE.Group();
  const material = new THREE.LineBasicMaterial({ color: 0x39bbae, transparent: true, opacity: 0.31 });
  [-4.7, -3.45, -2.2, -0.95, 0.3].forEach((z, index) => {
    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(6.3 - index * 0.18, 5.05 - index * 0.12, 0.04));
    const frame = new THREE.LineSegments(edges, material);
    frame.position.set(0, 0.15, z);
    group.add(frame);
  });
  return group;
}
