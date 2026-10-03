export function createAquariumScene(THREE, { reducedMotion = false } = {}) {
  const root = new THREE.Group();
  root.name = "AQUARIUM";
  const animationScale = reducedMotion ? 0.22 : 1;

  const hemi = new THREE.HemisphereLight(0x8deeff, 0x03131a, 1.65);
  root.add(hemi);
  const sunlight = new THREE.DirectionalLight(0xc9ffff, 2.7);
  sunlight.position.set(-2.5, 6, 4);
  sunlight.castShadow = true;
  sunlight.shadow.mapSize.set(512, 512);
  sunlight.shadow.camera.left = -5;
  sunlight.shadow.camera.right = 5;
  sunlight.shadow.camera.top = 5;
  sunlight.shadow.camera.bottom = -5;
  root.add(sunlight);
  const aquaLight = new THREE.PointLight(0x1cbcd1, 16, 10, 2);
  aquaLight.position.set(2.4, 0.4, 2.2);
  root.add(aquaLight);

  const backdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 9),
    new THREE.MeshStandardMaterial({ color: 0x062532, roughness: 0.92, metalness: 0.02 }),
  );
  backdrop.position.set(0, 0.1, -5.4);
  root.add(backdrop);

  const seabed = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 15, 12, 12),
    new THREE.MeshStandardMaterial({ color: 0x31534d, roughness: 0.94, metalness: 0.02 }),
  );
  seabed.rotation.x = -Math.PI / 2;
  seabed.position.set(0, -2.45, -1.8);
  seabed.receiveShadow = true;
  root.add(seabed);

  const waterGeometry = new THREE.PlaneGeometry(10, 12, 18, 22);
  const waterBase = Float32Array.from(waterGeometry.attributes.position.array);
  const water = new THREE.Mesh(
    waterGeometry,
    new THREE.MeshPhysicalMaterial({
      color: 0x69dff0,
      transparent: true,
      opacity: 0.25,
      roughness: 0.13,
      metalness: 0.05,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 2.55, -1.4);
  water.renderOrder = 3;
  root.add(water);
  const rippleMaterial = new THREE.MeshBasicMaterial({ color: 0x8efff2, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide });
  [0.9, 1.55, 2.25].forEach((radius, index) => {
    const ripple = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.018, 6, 54), rippleMaterial);
    ripple.rotation.x = Math.PI / 2;
    ripple.position.set((index - 1) * 0.65, 2.49 - index * 0.025, -1.1 - index * 0.7);
    ripple.renderOrder = 4;
    root.add(ripple);
  });

  const beams = [];
  [-1.9, 0, 1.75].forEach((x, index) => {
    const beam = new THREE.Mesh(
      new THREE.ConeGeometry(0.75 + index * 0.12, 5.5, 18, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x9efff1, transparent: true, opacity: 0.045, depthWrite: false, side: THREE.DoubleSide }),
    );
    beam.position.set(x, 0.15, -1.6 - index * 0.4);
    beam.rotation.z = index === 1 ? 0.05 : (index - 1) * 0.13;
    beam.renderOrder = 1;
    root.add(beam);
    beams.push(beam);
  });

  const rocks = createRocksAndCoral(THREE);
  root.add(rocks);
  const fish = [
    createFish(THREE, { size: 0.42, color: 0x79d5c9, x: -1.2, y: 0.78, z: -2.9, direction: 1 }),
    createFish(THREE, { size: 0.68, color: 0xffaa68, x: 0.85, y: -0.05, z: -0.55, direction: -1 }),
    createFish(THREE, { size: 0.92, color: 0x79bfff, x: -1.6, y: -0.78, z: 1.2, direction: 1 }),
  ];
  fish.forEach((item) => root.add(item));

  const bubbles = createBubbles(THREE);
  bubbles.forEach((bubble) => root.add(bubble));

  return {
    root,
    config: {
      id: "aquarium",
      label: "AQUARIUM",
      background: 0x03151f,
      fog: { type: "exp2", color: 0x062631, density: 0.072 },
      cameraRange: 1,
      fov: 42,
      shadows: true,
    },
    update(time) {
      const seconds = time * 0.001;
      const position = waterGeometry.attributes.position;
      for (let index = 0; index < position.count; index += 1) {
        const offset = index * 3;
        const x = waterBase[offset];
        const y = waterBase[offset + 1];
        position.array[offset + 2] = Math.sin(x * 1.2 + seconds * 0.55) * 0.055 * animationScale
          + Math.cos(y * 0.85 + seconds * 0.4) * 0.035 * animationScale;
      }
      position.needsUpdate = true;

      fish.forEach((item, index) => {
        const phase = seconds * (0.11 + index * 0.018) + item.userData.phase;
        item.position.x = item.userData.baseX + Math.sin(phase) * (0.34 + index * 0.08) * animationScale;
        item.position.y = item.userData.baseY + Math.sin(phase * 1.7) * 0.055 * animationScale;
        item.rotation.y = item.userData.baseRotationY + Math.sin(phase) * 0.045 * animationScale;
      });

      bubbles.forEach((bubble, index) => {
        bubble.position.y += bubble.userData.speed * animationScale;
        bubble.position.x = bubble.userData.baseX + Math.sin(seconds * 0.23 + index * 1.7) * bubble.userData.drift * animationScale;
        if (bubble.position.y > 2.72) bubble.position.y = -2.4 - (index % 3) * 0.35;
      });
      beams.forEach((beam, index) => { beam.material.opacity = 0.04 + Math.sin(seconds * 0.35 + index) * 0.012 * animationScale; });
    },
  };
}

function createFish(THREE, { size, color, x, y, z, direction }) {
  const fish = new THREE.Group();
  const bodyMaterial = new THREE.MeshStandardMaterial({ color, roughness: 0.44, metalness: 0.08 });
  const finMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).offsetHSL(0.02, 0.04, -0.12), roughness: 0.6, side: THREE.DoubleSide });
  const body = new THREE.Mesh(new THREE.SphereGeometry(size, 20, 14), bodyMaterial);
  body.scale.set(1.55, 0.72, 0.64);
  body.castShadow = true;
  fish.add(body);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(size * 0.72, size * 1.05, 3), finMaterial);
  tail.rotation.z = Math.PI / 2;
  tail.position.x = -direction * size * 1.62;
  tail.scale.z = 0.55;
  fish.add(tail);
  const topFin = new THREE.Mesh(new THREE.ConeGeometry(size * 0.34, size * 0.7, 3), finMaterial);
  topFin.position.y = size * 0.6;
  topFin.rotation.z = Math.PI;
  fish.add(topFin);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(size * 0.09, 10, 8), new THREE.MeshBasicMaterial({ color: 0xeaffff }));
  eye.position.set(direction * size * 1.28, size * 0.13, size * 0.37);
  fish.add(eye);
  fish.position.set(x, y, z);
  fish.rotation.y = direction < 0 ? Math.PI : 0;
  fish.userData.baseX = x;
  fish.userData.baseY = y;
  fish.userData.baseRotationY = fish.rotation.y;
  fish.userData.phase = (z + 3) * 1.7;
  return fish;
}

function createBubbles(THREE) {
  const specs = [
    [-2.42, 0.95, 2.45, 0.48], [2.38, -0.25, 2.15, 0.36], [-1.2, -1.5, 1.15, 0.19],
    [1.15, 0.5, 0.25, 0.15], [-0.45, -1.1, -0.4, 0.12], [0.35, 1.4, -1.1, 0.1],
    [1.7, -1.65, -2.4, 0.09], [-1.75, 0.1, -3.1, 0.08], [0.72, -0.55, 1.72, 0.14],
    [-0.15, 1.9, -2.2, 0.07], [2.05, 1.45, -0.8, 0.11], [-2.05, -0.75, 0.1, 0.16],
  ];
  return specs.map(([x, y, z, radius], index) => {
    const bubble = new THREE.Mesh(
      new THREE.SphereGeometry(radius, radius > 0.25 ? 22 : 14, 10),
      new THREE.MeshPhysicalMaterial({ color: 0xb8ffff, transparent: true, opacity: radius > 0.25 ? 0.18 : 0.32, roughness: 0.05, metalness: 0.02, depthWrite: false }),
    );
    bubble.position.set(x, y, z);
    bubble.renderOrder = z > 1 ? 5 : 3;
    bubble.userData.baseX = x;
    bubble.userData.speed = 0.0014 + (index % 4) * 0.00045;
    bubble.userData.drift = 0.04 + radius * 0.1;
    return bubble;
  });
}

function createRocksAndCoral(THREE) {
  const group = new THREE.Group();
  const rockMaterial = new THREE.MeshStandardMaterial({ color: 0x274b49, roughness: 0.9, metalness: 0.03 });
  const rockSpecs = [[-2.2,-2.05,1.9,1.05],[2.5,-1.95,2.25,1.25],[-0.65,-2.12,-.25,.72],[1.05,-2.2,-2.2,.86],[-2.25,-2.15,-2.8,.75]];
  rockSpecs.forEach(([x,y,z,size], index) => {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(size, 0), rockMaterial);
    rock.position.set(x,y,z);
    rock.scale.set(1, .66 + index * .035, .82);
    rock.rotation.set(index * .18, index * .57, 0);
    rock.castShadow = true;
    rock.receiveShadow = true;
    group.add(rock);
  });
  const coralMaterial = new THREE.MeshStandardMaterial({ color: 0xd97972, roughness: .62 });
  [-1.3, 1.65].forEach((x, side) => {
    for (let branch = 0; branch < 3; branch += 1) {
      const coral = new THREE.Mesh(new THREE.CylinderGeometry(.08, .13, .9 - branch * .12, 7), coralMaterial);
      coral.position.set(x + (branch - 1) * .18, -1.83, -0.6 - side * .9);
      coral.rotation.z = (branch - 1) * .27;
      group.add(coral);
    }
  });
  return group;
}
