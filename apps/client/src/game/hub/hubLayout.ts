import { HUB_HEIGHT_TILES, HUB_WIDTH_TILES } from "@dark-extract/shared";
import { TILE } from "../art/TextureFactory";

export const CONTRACTS_TILE = { tx: 20, ty: 8 };
export const CONTRACTS_RADIUS = 48;

export function getHubTileIndex(tx: number, ty: number): number {
  const edge =
    tx === 0 || ty === 0 || tx === HUB_WIDTH_TILES - 1 || ty === HUB_HEIGHT_TILES - 1;
  if (edge) return TILE.HUB_WALL;

  const plaza = tx > 14 && tx < 26 && ty > 10 && ty < 20;
  if (plaza) return TILE.HUB_PLAZA;

  const path =
    (ty === 15 && tx > 8 && tx < 32) ||
    (tx === 20 && ty > 6 && ty < 24) ||
    (ty === 22 && tx > 6 && tx < 34);
  if (path) return TILE.HUB_PATH;

  return TILE.HUB_GROUND;
}

export { HUB_WIDTH_TILES, HUB_HEIGHT_TILES };
