import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { Ray } from "@babylonjs/core/Culling/ray";
import { KeyboardEventTypes } from "@babylonjs/core/Events/keyboardEvents";
import { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";
import { DEFAULT_MOVEMENT_SETTINGS, normalizeMovementSettings, type MovementSettings } from "./movementSettings";

export interface PlayerController {
  camera: UniversalCamera;
  setMoveInput: (x: number, y: number) => void;
  setSprinting: (active: boolean) => void;
  setMovementSpeeds: (settings: MovementSettings) => void;
  setInputEnabled: (enabled: boolean) => void;
  setNoClip: (enabled: boolean) => void;
  isNoClip: () => boolean;
  jump: () => void;
  rotate: (deltaX: number, deltaY: number) => void;
}

export function createPlayer(scene: Scene, canvas: HTMLCanvasElement, mobile: boolean): PlayerController {
  const jumpSpeed = 6.2;
  const jumpGravity = 9;
  let movementSettings = { ...DEFAULT_MOVEMENT_SETTINGS };
  const camera = new UniversalCamera("player-camera", new Vector3(0, 2.1, -12), scene);
  camera.minZ = .1;
  camera.maxZ = 180;
  camera.speed = movementSettings.normalSpeed;
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
  let inputEnabled = true;
  let noClip = false;
  scene.onBeforeRenderObservable.add(() => {
    const deltaTime = Math.min(scene.getEngine().getDeltaTime() / 1000, .05);

    if (noClip) {
      verticalVelocity = 0; camera.cameraDirection.y = sprinting ? -3.2 * deltaTime : 0;
    } else if (verticalVelocity <= 0 && isGrounded(scene, camera)) {
      verticalVelocity = 0;
      camera.cameraDirection.y = -.02;
    } else {
      verticalVelocity -= jumpGravity * deltaTime;
      camera.cameraDirection.y = verticalVelocity * deltaTime;
    }

    if (!inputEnabled) {
      camera.cameraDirection.x = 0; camera.cameraDirection.z = 0; camera.cameraRotation.setAll(0);
    } else if (mobile && (moveX || moveY)) {
      // タッチ操作は従来の体感速度を基準に、MENUで設定した速度の倍率を反映する。
      const mobileNormalSpeed = 4 * movementSettings.normalSpeed / DEFAULT_MOVEMENT_SETTINGS.normalSpeed;
      const mobileModifiedSpeed = 7 * movementSettings.shiftSpeed / DEFAULT_MOVEMENT_SETTINGS.shiftSpeed;
      const speed = (sprinting ? mobileModifiedSpeed : mobileNormalSpeed) * deltaTime;
      const forward = Vector3.TransformNormal(Vector3.Forward(), Matrix.RotationY(camera.rotation.y));
      const right = Vector3.TransformNormal(Vector3.Right(), Matrix.RotationY(camera.rotation.y));
      camera.cameraDirection.addInPlace(forward.scale(moveY * speed));
      camera.cameraDirection.addInPlace(right.scale(moveX * speed));
    }
  });

  scene.onKeyboardObservable.add((info) => {
    const event = info.event;
    if (!inputEnabled) return;
    if (event.code === "ShiftLeft" || event.code === "ShiftRight") {
      sprinting = info.type === KeyboardEventTypes.KEYDOWN;
      applyCurrentSpeed();
    }
    if (info.type === KeyboardEventTypes.KEYDOWN && event.code === "Space") {
      jump();
      event.preventDefault();
    }
  });

  function jump(): void {
    if (!inputEnabled) return;
    if (noClip) { camera.position.y += .65; return; }
    if (verticalVelocity <= 0 && isGrounded(scene, camera)) verticalVelocity = jumpSpeed;
  }

  return {
    camera,
    setMoveInput: (x, y) => { moveX = x; moveY = y; },
    setSprinting: (active) => { sprinting = active; applyCurrentSpeed(); },
    setMovementSpeeds: (settings) => { movementSettings = normalizeMovementSettings(settings); applyCurrentSpeed(); },
    setInputEnabled: (enabled) => {
      inputEnabled = enabled; moveX = 0; moveY = 0; sprinting = false; applyCurrentSpeed();
      if (enabled) camera.attachControl(canvas, true); else { camera.detachControl(); if (document.pointerLockElement === canvas) void document.exitPointerLock(); }
    },
    setNoClip: (enabled) => { noClip = enabled; camera.checkCollisions = !enabled; verticalVelocity = 0; camera.cameraDirection.y = 0; },
    isNoClip: () => noClip,
    jump,
    rotate: (deltaX, deltaY) => {
      if (!inputEnabled) return;
      camera.cameraRotation.y += deltaX / 340;
      camera.cameraRotation.x += deltaY / 340;
    },
  };

  function applyCurrentSpeed(): void {
    camera.speed = sprinting ? movementSettings.shiftSpeed : movementSettings.normalSpeed;
  }
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
