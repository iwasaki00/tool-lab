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
  const jumpSpeed = 6.2;
  const jumpGravity = 9;
  const normalMoveSpeed = 2.88;
  const precisionMoveSpeed = .32;
  const camera = new UniversalCamera("player-camera", new Vector3(0, 2.1, -12), scene);
  camera.minZ = .1;
  camera.maxZ = 180;
  camera.speed = normalMoveSpeed;
  camera.angularSensibility = 2800;
  camera.inertia = .45;
  camera.keysUp = [87];
  camera.keysDown = [83];
  camera.keysLeft = [65];
  camera.keysRight = [68];
  camera.checkCollisions = true;
  // Babylon標準の重力はフレーム単位で加算されるため、ジャンプだけは
  // deltaTime基準の速度計算にして端末ごとのFPS差を受けにくくする。
  camera.applyGravity = false;
  camera.needMoveForGravity = true;
  camera.ellipsoid = new Vector3(.43, .88, .43);
  camera.ellipsoidOffset = new Vector3(0, -.78, 0);
  camera.attachControl(canvas, true);
  scene.activeCamera = camera;

  if (mobile) camera.inputs.removeByType("FreeCameraTouchInput");

  let moveX = 0;
  let moveY = 0;
  let sprinting = false;
  let verticalVelocity = 0;
  scene.onBeforeRenderObservable.add(() => {
    const deltaTime = Math.min(scene.getEngine().getDeltaTime() / 1000, .05);

    if (verticalVelocity <= 0 && isGrounded(scene, camera)) {
      verticalVelocity = 0;
      camera.cameraDirection.y = -.02;
    } else {
      verticalVelocity -= jumpGravity * deltaTime;
      camera.cameraDirection.y = verticalVelocity * deltaTime;
    }

    if (mobile && (moveX || moveY)) {
      const speed = (sprinting ? 7 : 4) * deltaTime;
      const forward = Vector3.TransformNormal(Vector3.Forward(), Matrix.RotationY(camera.rotation.y));
      const right = Vector3.TransformNormal(Vector3.Right(), Matrix.RotationY(camera.rotation.y));
      camera.cameraDirection.addInPlace(forward.scale(moveY * speed));
      camera.cameraDirection.addInPlace(right.scale(moveX * speed));
    }
  });

  scene.onKeyboardObservable.add((info) => {
    const event = info.event;
    if (event.code === "ShiftLeft" || event.code === "ShiftRight") {
      sprinting = info.type === KeyboardEventTypes.KEYDOWN;
      camera.speed = sprinting ? precisionMoveSpeed : normalMoveSpeed;
    }
    if (info.type === KeyboardEventTypes.KEYDOWN && event.code === "Space") {
      jump();
      event.preventDefault();
    }
  });

  function jump(): void {
    if (verticalVelocity <= 0 && isGrounded(scene, camera)) verticalVelocity = jumpSpeed;
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
  // FreeCamera._collideWithWorld()と同じ座標変換でコライダー中心を求める。
  // camera.position（目線位置）から直接短いRayを飛ばすと、負の
  // ellipsoidOffset分だけ足元へ届かず、常に未接地と判定されてしまう。
  const colliderCenter = camera.position
    .subtract(new Vector3(0, camera.ellipsoid.y, 0))
    .add(camera.ellipsoidOffset);
  const ray = new Ray(colliderCenter, Vector3.Down(), camera.ellipsoid.y + .3);
  const hit = scene.pickWithRay(ray, (mesh) => mesh.checkCollisions);
  return Boolean(hit?.hit);
}
