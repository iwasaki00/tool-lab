import { Color3 } from "@babylonjs/core/Maths/math.color";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { ObjectContext } from "../objects/primitives";
import type { SeededRandom } from "../random/seededRandom";
import { createMaterial } from "../utils/materials";
import type { LocalBounds, RoomType } from "../interior/Room";

export function createRoomFurniture(ctx: ObjectContext, root: Mesh, roomId: string, type: RoomType, bounds: LocalBounds, floorY: number, random: SeededRandom): void {
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerZ = (bounds.minZ + bounds.maxZ) / 2;
  const dark = ctx.materials?.getWoodMaterial() ?? createMaterial(ctx.scene, `${roomId}-furniture`, new Color3(.25, .2, .16));
  const metal = ctx.materials?.getMetalMaterial() ?? createMaterial(ctx.scene, `${roomId}-metal`, new Color3(.28, .32, .34), .35);
  const fabric = ctx.materials?.getFabricMaterial() ?? createMaterial(ctx.scene, `${roomId}-fabric`, new Color3(.2, .34, .39));

  if (type === "OFFICE") {
    box("office-desk", 2, .75, .85, centerX, floorY + .375, centerZ, dark, true);
    box("office-chair", .65, .6, .65, centerX, floorY + .3, centerZ + 1.05, fabric, true);
    shelf(centerX + (centerX < 0 ? -1.4 : 1.4), centerZ, floorY, metal);
  } else if (type === "STORAGE") {
    shelf(centerX + (centerX < 0 ? -1.2 : 1.2), centerZ, floorY, metal);
    for (let i = 0; i < 3; i += 1) box("storage-box", random.range(.65, 1), random.range(.55, .9), random.range(.65, 1), centerX + random.range(-1, 1), floorY + .4, centerZ + random.range(-1, 1), dark, true);
  } else if (type === "LIVING_ROOM") {
    box("living-table", 1.5, .55, 1, centerX, floorY + .275, centerZ, dark, true);
    box("living-sofa", 2.3, .75, .8, centerX, floorY + .375, centerZ + 1.4, fabric, true);
    box("living-sofa-back", 2.3, .85, .22, centerX, floorY + .85, centerZ + 1.72, fabric, false);
  } else if (type === "CONTROL_ROOM") {
    box("control-console", 2.4, 1.15, .65, centerX, floorY + .575, centerZ + .8, metal, true);
    box("control-monitor", 1.75, .7, .08, centerX, floorY + 1.35, centerZ + .48, ctx.materials?.getScreenMaterial() ?? fabric, false);
  }

  function shelf(x: number, z: number, y: number, material: ReturnType<typeof createMaterial>): void {
    box("room-shelf", 1.6, 1.9, .35, x, y + .95, z, material, true);
  }

  function box(name: string, width: number, height: number, depth: number, x: number, y: number, z: number, material: ReturnType<typeof createMaterial>, collision: boolean): Mesh {
    const mesh = MeshBuilder.CreateBox(name, { width, height, depth }, ctx.scene);
    mesh.position.set(x, y, z); mesh.parent = root; mesh.material = material; mesh.checkCollisions = collision; mesh.receiveShadows = true;
    return mesh;
  }
}
