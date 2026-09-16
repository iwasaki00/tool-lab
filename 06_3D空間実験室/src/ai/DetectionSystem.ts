import { Ray } from "@babylonjs/core/Culling/ray";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";

export interface DetectionResult { detected: boolean; distance: number; inFov: boolean; lineOfSight: boolean }

export class DetectionSystem {
  private lastCheck = -Infinity;
  private cached: DetectionResult = { detected: false, distance: Infinity, inFov: false, lineOfSight: false };

  constructor(private readonly scene: Scene, private readonly intervalMs = 180) {}

  detect(origin: Vector3, yaw: number, player: Vector3, range: number, fovDegrees = 105, force = false): DetectionResult {
    const distance = Vector3.Distance(origin, player);
    if (!force && performance.now() - this.lastCheck < this.intervalMs) return { ...this.cached, distance };
    this.lastCheck = performance.now();
    if (distance > range) return this.cached = { detected: false, distance, inFov: false, lineOfSight: false };
    const forward = new Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const direction = player.subtract(origin); direction.y = 0;
    const planarLength = direction.length(); if (planarLength < .01) return this.cached = { detected: true, distance, inFov: true, lineOfSight: true };
    direction.scaleInPlace(1 / planarLength);
    const inFov = Vector3.Dot(forward, direction) >= Math.cos(fovDegrees * Math.PI / 360);
    if (!inFov) return this.cached = { detected: false, distance, inFov, lineOfSight: false };
    const eye = origin.add(new Vector3(0, 1.45, 0));
    const target = player.add(new Vector3(0, -.25, 0));
    const rayDirection = target.subtract(eye); const rayLength = rayDirection.length(); rayDirection.normalize();
    const hit = this.scene.pickWithRay(new Ray(eye, rayDirection, rayLength), (mesh) => mesh.checkCollisions && !mesh.metadata?.characterId && !mesh.name.includes("ground"));
    const lineOfSight = !hit?.hit || (hit.distance ?? Infinity) >= rayLength - .55;
    return this.cached = { detected: inFov && lineOfSight, distance, inFov, lineOfSight };
  }
}
