import { TILE_SIZE } from "./constants.js";

/** Goblin cave contract board in hub (tile coords) */
export const HUB_CONTRACTS_TILE = { tx: 20, ty: 8 };
export const HUB_CONTRACTS_RADIUS_PX = 52;

export function hubContractsWorldCenter(): { x: number; y: number } {
  return {
    x: HUB_CONTRACTS_TILE.tx * TILE_SIZE + TILE_SIZE / 2,
    y: HUB_CONTRACTS_TILE.ty * TILE_SIZE + TILE_SIZE / 2,
  };
}

export function isNearHubContracts(x: number, y: number): boolean {
  const c = hubContractsWorldCenter();
  return Math.hypot(x - c.x, y - c.y) <= HUB_CONTRACTS_RADIUS_PX;
}
