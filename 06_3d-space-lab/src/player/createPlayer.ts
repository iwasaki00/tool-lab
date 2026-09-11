import { KeyboardEventTypes, Ray, Scene, UniversalCamera, Vector3 } from "@babylonjs/core";

export function createPlayer(scene: Scene, canvas: HTMLCanvasElement): UniversalCamera {
  const camera = new UniversalCamera("player-camera", new Vector3(0, 2.1, -12), scene);
  camera.minZ = .08;
  camera.speed = .32;
  camera.angularSensibility = 2800;
  camera.inertia = .45;
  camera.keysUp = [87];
  camera.keysDown = [83];
  camera.keysLeft = [65];
  camera.keysRight = [68];
  camera.checkCollisions = true;
  camera.applyGravity = true;
  camera.ellipsoid = new Vector3(.43, .88, .43);
  camera.ellipsoidOffset = new Vector3(0, -.78, 0);
  camera.attachControl(canvas, true);

  let sprinting = false;
  scene.onKeyboardObservable.add((info) => {
    const event = info.event;
    if (event.code === "ShiftLeft" || event.code === "ShiftRight") {
      sprinting = info.type === KeyboardEventTypes.KEYDOWN;
      camera.speed = sprinting ? .55 : .32;
    }
    if (info.type === KeyboardEventTypes.KEYDOWN && event.code === "Space" && isGrounded(scene, camera)) {
      camera.cameraDirection.y = .28;
      event.preventDefault();
    }
  });

  return camera;
}

function isGrounded(scene: Scene, camera: UniversalCamera): boolean {
  const ray = new Ray(camera.position.add(new Vector3(0, -.65, 0)), Vector3.Down(), 1.25);
  const hit = scene.pickWithRay(ray, (mesh) => mesh.checkCollisions);
  return Boolean(hit?.hit);
}
