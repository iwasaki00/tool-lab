import { Mesh, Vector3 } from "@babylonjs/core";
import { createBox, createCylinder, createSphere, type ObjectContext } from "../objects/primitives";

export function createRandomScene(ctx: ObjectContext, dynamicRoots: Mesh[], amount = 18): void {
  clearGeneratedScene(dynamicRoots);
  for (let i = 0; i < amount; i += 1) {
    const position = randomOpenPosition(10, 28);
    const type = i % 3;
    if (type === 0) createBox(ctx, new Vector3(position.x, .5 + Math.random(), position.z), 1 + Math.random() * 1.4, true);
    else if (type === 1) createSphere(ctx, new Vector3(position.x, .65 + Math.random() * .4, position.z), 1.2 + Math.random(), true);
    else createCylinder(ctx, new Vector3(position.x, 1.1, position.z), 2.2, 1.1, true);
  }
}

export function clearGeneratedScene(dynamicRoots: Mesh[]): void {
  dynamicRoots.splice(0).forEach((mesh) => mesh.dispose(false, true));
}

export function randomOpenPosition(minRadius: number, maxRadius: number): Vector3 {
  const angle = Math.random() * Math.PI * 2;
  const radius = minRadius + Math.random() * (maxRadius - minRadius);
  return new Vector3(Math.cos(angle) * radius, 1, Math.sin(angle) * radius);
}
