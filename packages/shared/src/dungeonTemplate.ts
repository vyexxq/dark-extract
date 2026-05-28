import {
  DUNGEON_HEIGHT_TILES,
  DUNGEON_WIDTH_TILES,
  DungeonTile,
  type DungeonMap,
  type DungeonRoom,
} from "./dungeon.js";
import { mulberry32, randomInt } from "./rng.js";

function idx(x: number, y: number, width: number): number {
  return y * width + x;
}

function carveRect(
  tiles: DungeonTile[],
  width: number,
  height: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
  tile: DungeonTile,
): void {
  for (let y = ry; y < ry + rh; y++) {
    for (let x = rx; x < rx + rw; x++) {
      if (x >= 0 && y >= 0 && x < width && y < height) {
        tiles[idx(x, y, width)] = tile;
      }
    }
  }
}

function linkRooms(
  tiles: DungeonTile[],
  width: number,
  _height: number,
  rooms: DungeonRoom[],
): void {
  const sorted = [...rooms].sort((a, b) => a.cx - b.cx || a.cy - b.cy);
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const cur = sorted[i]!;
    const minX = Math.min(prev.cx, cur.cx);
    const maxX = Math.max(prev.cx, cur.cx);
    for (let x = minX; x <= maxX; x++) {
      if (tiles[idx(x, prev.cy, width)] === DungeonTile.Wall) {
        tiles[idx(x, prev.cy, width)] = DungeonTile.Corridor;
      }
    }
    const minY = Math.min(prev.cy, cur.cy);
    const maxY = Math.max(prev.cy, cur.cy);
    for (let y = minY; y <= maxY; y++) {
      if (tiles[idx(cur.cx, y, width)] === DungeonTile.Wall) {
        tiles[idx(cur.cx, y, width)] = DungeonTile.Corridor;
      }
    }
  }
}

/** Fixed goblin-cave layout with seed-based enemy placement */
export function generateGoblinCaveTemplate(
  seed: number,
  width = DUNGEON_WIDTH_TILES,
  height: number = DUNGEON_HEIGHT_TILES,
): DungeonMap {
  const rng = mulberry32(seed);
  const tiles = new Array<DungeonTile>(width * height).fill(DungeonTile.Wall);

  const templateRooms: Omit<DungeonRoom, "cx" | "cy">[] = [
    { x: 4, y: 14, w: 9, h: 7 },
    { x: 16, y: 8, w: 10, h: 8 },
    { x: 16, y: 20, w: 11, h: 7 },
    { x: 30, y: 12, w: 10, h: 9 },
    { x: 38, y: 6, w: 8, h: 8 },
  ];

  const rooms: DungeonRoom[] = templateRooms.map((r) => {
    carveRect(tiles, width, height, r.x, r.y, r.w, r.h, DungeonTile.Floor);
    return {
      ...r,
      cx: r.x + Math.floor(r.w / 2),
      cy: r.y + Math.floor(r.h / 2),
    };
  });

  linkRooms(tiles, width, height, rooms);

  const spawn = { x: rooms[0]!.cx, y: rooms[0]!.cy };
  tiles[idx(spawn.x, spawn.y, width)] = DungeonTile.Spawn;

  const extract = { x: rooms[rooms.length - 1]!.cx, y: rooms[rooms.length - 1]!.cy };
  tiles[idx(extract.x, extract.y, width)] = DungeonTile.Extract;

  const enemySpawns: { x: number; y: number }[] = [];
  const pool = rooms.slice(1);
  const count = Math.min(8, 3 + Math.floor(pool.length * 1.5));
  for (let i = 0; i < count; i++) {
    const room = pool[i % pool.length]!;
    const x = randomInt(rng, room.x + 1, room.x + room.w - 2);
    const y = randomInt(rng, room.y + 1, room.y + room.h - 2);
    if (Math.abs(x - spawn.x) + Math.abs(y - spawn.y) < 5) continue;
    enemySpawns.push({ x, y });
  }

  return { seed, width, height, tiles, spawn, extract, enemySpawns };
}
