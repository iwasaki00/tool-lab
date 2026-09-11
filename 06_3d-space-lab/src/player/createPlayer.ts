import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { Ray } from "@babylonjs/core/Culling/ray";
import { KeyboardEventTypes } from "@babylonjs/core/Events/keyboardEvents";
import { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";

export interface PlayerController {
  camera: UniversalCamera;
  setMoveInput: (x: number, y: number) => void;
  setSprinting: (active: boolean) => void;
  jump: () => void;
  rotate: (deltaX: number, deltaY: number) => void;
}

export function createPlayer(scene: Scene, canvas: HTMLCanvasElement, mobile: boolean): PlayerController {
  const camera = new UniversalCamera("player-camera", new Vector3(0, 2.1, -12), scene);
  camera.minZ = .1;
  camera.maxZ = 180;
  camera.speed = .32;
  camera.angularSensibility = 2800;
  camera.inertia = .45;
  camera.keysUp = [87];
  camera.keysDown = [83];
  camera.keysLeft = [65];
  camera.keysRight = [68];
  camera.checkCollisions = true;
  camera.applyGravity = true;
  camera.needMoveForGravity = true;
  camera.ellipsoid = new Vector3(.43, .88, .43);
  camera.ellipsoidOffset = new Vector3(0, -.78, 0);
  camera.attachControl(canvas, true);
  scene.activeCamera = camera;

  if (mobile) camera.inputs.removeByType("FreeCameraTouchInput");

  let moveX = 0;
  let moveY = 0;
  let sprinting = false;
  scene.onBeforeRenderObservable.add(() => {
    if (!mobile || (!moveX && !moveY)) return;
    const speed = (sprinting ? .007 : .004) * scene.getEngine().getDeltaTime();
    const forward = Vector3.TransformNormal(Vector3.Forward(), Matrix.RotationY(camera.rotation.y));
    const right = Vector3.TransformNormal(Vector3.Right(), Matrix.RotationY(camera.rotation.y));
    camera.cameraDirection.addInPlace(forward.scale(moveY * speed));
    camera.cameraDirection.addInPlace(right.scale(moveX * speed));
  });

  scene.onKeyboardObservable.add((info) => {
    const event = info.event;
    if (event.code === "ShiftLeft" || event.code === "ShiftRight") {
      sprinting = info.type === KeyboardEventTypes.KEYDOWN;
      camera.speed = sprinting ? .55 : .32;
    }
    if (info.type === KeyboardEventTypes.KEYDOWN && event.code === "Space") {
      jump();
      event.preventDefault();
    }
  });

  function jump(): void {
    // FreeCameraは毎フレームcameraDirectionへscene.gravityを加算してから
    // inertiaを適用するため、重力値を十分に上回る初速が必要になる。
    if (isGrounded(scene, camera)) camera.cameraDirection.y = .9;
  }

  return {
    camera,
    setMoveInput: (x, y) => { moveX = x; moveY = y; },
    setSprinting: (active) => { sprinting = active; },
    jump,
    rotate: (deltaX, deltaY) => {
      camera.cameraRotation.y += deltaX / 340;
      camera.cameraRotation.x += deltaY / 340;
    },
  };
}

function isGrounded(scene: Scene, camera: UniversalCamera): boolean {
  const feetDistance = camera.ellipsoid.y - camera.ellipsoidOffset.y;
  const ray = new Ray(camera.position, Vector3.Down(), feetDistance + .22);
  const hit = scene.pickWithRay(ray, (mesh) => mesh.checkCollisions);
  return Boolean(hit?.hit);
}
