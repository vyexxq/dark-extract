import { mulberry32, randomInt } from "./rng.js";

export const DUNGEON_WIDTH_TILES = 48;
export const DUNGEON_HEIGHT_TILES = 36;

export enum DungeonTile {
  Wall = 0,
  Floor = 1,
  Corridor = 2,
  Spawn = 3,
  Extract = 4,
}

export interface DungeonRoom {
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
}

export interface DungeonMap {
  seed: number;
  width: number;
  height: number;
  tiles: DungeonTile[];
  spawn: { x: number; y: number };
  extract: { x: number; y: number };
  enemySpawns: { x: number; y: number }[];
}

function idx(x: number, y: number, width: number): number {
  return y * width + x;
}

function inBounds(x: number, y: number, w: number, h: number): boolean {
  return x >= 0 && y >= 0 && x < w && y < h;
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
      if (inBounds(x, y, width, height)) {
        tiles[idx(x, y, width)] = tile;
      }
    }
  }
}

function carveHorzCorridor(
  tiles: DungeonTile[],
  width: number,
  height: number,
  x1: number,
  x2: number,
  y: number,
): void {
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  for (let x = minX; x <= maxX; x++) {
    if (inBounds(x, y, width, height) && tiles[idx(x, y, width)] === DungeonTile.Wall) {
      tiles[idx(x, y, width)] = DungeonTile.Corridor;
    }
  }
}

function carveVertCorridor(
  tiles: DungeonTile[],
  width: number,
  height: number,
  y1: number,
  y2: number,
  x: number,
): void {
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);
  for (let y = minY; y <= maxY; y++) {
    if (inBounds(x, y, width, height) && tiles[idx(x, y, width)] === DungeonTile.Wall) {
      tiles[idx(x, y, width)] = DungeonTile.Corridor;
    }
  }
}

function manhattan(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/**
 * Procedural dungeon: random rooms on a grid + corridor links.
 * Same seed always produces the same layout (client preview = server truth).
 */
export function generateDungeon(
  seed: number,
  width = DUNGEON_WIDTH_TILES,
  height = DUNGEON_HEIGHT_TILES,
): DungeonMap {
  const rng = mulberry32(seed);
  const tiles = new Array<DungeonTile>(width * height).fill(DungeonTile.Wall);

  const gridCols = 4;
  const gridRows = 3;
  const cellW = Math.floor((width - 2) / gridCols);
  const cellH = Math.floor((height - 2) / gridRows);
  const rooms: DungeonRoom[] = [];

  for (let gy = 0; gy < gridRows; gy++) {
    for (let gx = 0; gx < gridCols; gx++) {
      if (rng() > 0.72) continue;

      const maxRw = cellW - 3;
      const maxRh = cellH - 3;
      if (maxRw < 4 || maxRh < 4) continue;

      const rw = randomInt(rng, 4, maxRw);
      const rh = randomInt(rng, 4, maxRh);
      const rx = 1 + gx * cellW + randomInt(rng, 1, cellW - rw - 1);
      const ry = 1 + gy * cellH + randomInt(rng, 1, cellH - rh - 1);

      carveRect(tiles, width, height, rx, ry, rw, rh, DungeonTile.Floor);
      rooms.push({
        x: rx,
        y: ry,
        w: rw,
        h: rh,
        cx: Math.floor(rx + rw / 2),
        cy: Math.floor(ry + rh / 2),
      });
    }
  }

  if (rooms.length === 0) {
    const rw = 12;
    const rh = 10;
    const rx = Math.floor((width - rw) / 2);
    const ry = Math.floor((height - rh) / 2);
    carveRect(tiles, width, height, rx, ry, rw, rh, DungeonTile.Floor);
    rooms.push({ x: rx, y: ry, w: rw, h: rh, cx: rx + Math.floor(rw / 2), cy: ry + Math.floor(rh / 2) });
  }

  rooms.sort((a, b) => a.cx - b.cx || a.cy - b.cy);
  for (let i = 1; i < rooms.length; i++) {
    const prev = rooms[i - 1]!;
    const cur = rooms[i]!;
    carveHorzCorridor(tiles, width, height, prev.cx, cur.cx, prev.cy);
    carveVertCorridor(tiles, width, height, prev.cy, cur.cy, cur.cx);
  }

  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i] === DungeonTile.Corridor) {
      const x = i % width;
      const y = Math.floor(i / width);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (inBounds(nx, ny, width, height) && tiles[idx(nx, ny, width)] === DungeonTile.Wall) {
            tiles[idx(nx, ny, width)] = DungeonTile.Corridor;
          }
        }
      }
    }
  }

  const spawnRoom = rooms[0]!;
  const spawn = { x: spawnRoom.cx, y: spawnRoom.cy };
  tiles[idx(spawn.x, spawn.y, width)] = DungeonTile.Spawn;

  let extractRoom = rooms[0]!;
  let bestDist = -1;
  for (const room of rooms) {
    const d = manhattan(spawn, { x: room.cx, y: room.cy });
    if (d > bestDist) {
      bestDist = d;
      extractRoom = room;
    }
  }
  const extract = { x: extractRoom.cx, y: extractRoom.cy };
  tiles[idx(extract.x, extract.y, width)] = DungeonTile.Extract;

  const floorTiles: { x: number; y: number }[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const t = tiles[idx(x, y, width)]!;
      if (t === DungeonTile.Floor || t === DungeonTile.Corridor) {
        floorTiles.push({ x, y });
      }
    }
  }

  const enemyCount = Math.min(6, Math.max(2, Math.floor(rooms.length * 1.2)));
  const enemySpawns: { x: number; y: number }[] = [];
  const used = new Set<string>([
    `${spawn.x},${spawn.y}`,
    `${extract.x},${extract.y}`,
  ]);

  for (let i = 0; i < enemyCount && floorTiles.length > 0; i++) {
    const pick = floorTiles[randomInt(rng, 0, floorTiles.length - 1)]!;
    const key = `${pick.x},${pick.y}`;
    if (used.has(key) || manhattan(pick, spawn) < 6) {
      i--;
      continue;
    }
    used.add(key);
    enemySpawns.push(pick);
  }

  return { seed, width, height, tiles, spawn, extract, enemySpawns };
}

export function isWalkableTile(tile: DungeonTile): boolean {
  return tile !== DungeonTile.Wall;
}

export function tileAt(map: DungeonMap, x: number, y: number): DungeonTile {
  if (!inBounds(x, y, map.width, map.height)) return DungeonTile.Wall;
  return map.tiles[idx(x, y, map.width)]!;
}
