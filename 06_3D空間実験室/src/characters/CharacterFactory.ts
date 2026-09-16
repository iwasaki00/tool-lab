import { Color3 } from "@babylonjs/core/Maths/math.color";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { ObjectContext } from "../objects/primitives";

export interface HumanoidRig {
  root: TransformNode;
  body: Mesh;
  armL: Mesh;
  armR: Mesh;
  legL: Mesh;
  legR: Mesh;
  label: Mesh;
  labelTexture: DynamicTexture;
  setLabel: (title: string, detail?: string, alert?: boolean) => void;
  dispose: () => void;
}

export function createHumanoid(ctx: ObjectContext, id: string, type: "NPC" | "ENEMY"): HumanoidRig {
  const root = new TransformNode(`${id}-root`, ctx.scene);
  const primary = type === "NPC" ? new Color3(.18, .72, .9) : new Color3(.55, .08, .08);
  const accent = type === "NPC" ? new Color3(.96, .72, .22) : new Color3(.12, .12, .14);
  const skin = new Color3(.82, .62, .45);
  const materials = [
    makeMaterial(ctx, `${id}-primary`, primary),
    makeMaterial(ctx, `${id}-accent`, accent),
    makeMaterial(ctx, `${id}-skin`, skin),
  ];
  const body = part(MeshBuilder.CreateBox(`${id}-body`, { width: .5, height: .82, depth: .3 }, ctx.scene), 0, 1.1, 0, materials[0], root, ctx, id);
  const head = part(MeshBuilder.CreateSphere(`${id}-head`, { diameter: .42, segments: 10 }, ctx.scene), 0, 1.7, 0, materials[2], root, ctx, id);
  const armL = part(MeshBuilder.CreateCylinder(`${id}-arm-l`, { height: .72, diameter: .14, tessellation: 8 }, ctx.scene), -.34, 1.12, 0, materials[1], root, ctx, id);
  const armR = part(MeshBuilder.CreateCylinder(`${id}-arm-r`, { height: .72, diameter: .14, tessellation: 8 }, ctx.scene), .34, 1.12, 0, materials[1], root, ctx, id);
  const legL = part(MeshBuilder.CreateCylinder(`${id}-leg-l`, { height: .78, diameter: .17, tessellation: 8 }, ctx.scene), -.15, .42, 0, materials[1], root, ctx, id);
  const legR = part(MeshBuilder.CreateCylinder(`${id}-leg-r`, { height: .78, diameter: .17, tessellation: 8 }, ctx.scene), .15, .42, 0, materials[1], root, ctx, id);
  head.isPickable = false; armL.isPickable = false; armR.isPickable = false; legL.isPickable = false; legR.isPickable = false;

  const labelTexture = new DynamicTexture(`${id}-label-texture`, { width: 384, height: 128 }, ctx.scene, false);
  labelTexture.hasAlpha = true;
  const label = MeshBuilder.CreatePlane(`${id}-label`, { width: 1.65, height: .55 }, ctx.scene);
  label.parent = root; label.position.y = 2.22; label.billboardMode = Mesh.BILLBOARDMODE_ALL; label.isPickable = false;
  const labelMaterial = new StandardMaterial(`${id}-label-material`, ctx.scene);
  labelMaterial.diffuseTexture = labelTexture; labelMaterial.opacityTexture = labelTexture; labelMaterial.emissiveColor = Color3.White(); labelMaterial.disableLighting = true;
  label.material = labelMaterial;

  const setLabel = (title: string, detail = "", alert = false): void => {
    const context = labelTexture.getContext() as unknown as CanvasRenderingContext2D;
    context.clearRect(0, 0, 384, 128);
    context.fillStyle = alert ? "rgba(78,5,5,.9)" : "rgba(3,18,24,.82)"; context.fillRect(5, 5, 374, 118);
    context.strokeStyle = alert ? "#ff665d" : type === "NPC" ? "#72e1ff" : "#ff796f"; context.lineWidth = 5; context.strokeRect(5, 5, 374, 118);
    context.textAlign = "center"; context.fillStyle = alert ? "#fff0ee" : "#effcff"; context.font = "bold 42px monospace"; context.fillText(title, 192, detail ? 55 : 79);
    if (detail) { context.fillStyle = "#b9d0d9"; context.font = "bold 27px monospace"; context.fillText(detail, 192, 98); }
    labelTexture.update();
  };
  setLabel(type);

  return {
    root, body, armL, armR, legL, legR, label, labelTexture, setLabel,
    dispose: () => { root.dispose(false, true); labelTexture.dispose(); labelMaterial.dispose(); materials.forEach((material) => material.dispose()); },
  };
}

function part(mesh: Mesh, x: number, y: number, z: number, material: StandardMaterial, root: TransformNode, ctx: ObjectContext, id: string): Mesh {
  mesh.position.set(x, y, z); mesh.parent = root; mesh.material = material; mesh.receiveShadows = true; mesh.metadata = { characterId: id }; ctx.shadows.addShadowCaster(mesh); return mesh;
}

function makeMaterial(ctx: ObjectContext, name: string, color: Color3): StandardMaterial {
  const material = new StandardMaterial(name, ctx.scene); material.diffuseColor = color; material.specularColor = color.scale(.12); return material;
}
