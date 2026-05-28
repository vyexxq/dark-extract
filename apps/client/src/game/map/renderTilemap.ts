import Phaser from "phaser";
import { TILE_SIZE } from "@dark-extract/shared";

export function renderTileGrid(
  scene: Phaser.Scene,
  textureKey: string,
  width: number,
  height: number,
  getTileIndex: (tx: number, ty: number) => number,
  depth = 0,
): Phaser.GameObjects.Group {
  const group = scene.add.group();
  for (let ty = 0; ty < height; ty++) {
    for (let tx = 0; tx < width; tx++) {
      const frame = getTileIndex(tx, ty);
      const sprite = scene.add
        .image(tx * TILE_SIZE + TILE_SIZE / 2, ty * TILE_SIZE + TILE_SIZE / 2, textureKey, frame)
        .setDepth(depth);
      group.add(sprite);
    }
  }
  return group;
}
