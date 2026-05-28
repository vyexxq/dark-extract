import Phaser from "phaser";

/** Tile indices in the tileset spritesheet */
export const TILE = {
  HUB_GROUND: 0,
  HUB_PATH: 1,
  HUB_WALL: 2,
  HUB_PLAZA: 3,
  DUNGEON_FLOOR: 4,
  DUNGEON_WALL: 5,
  DUNGEON_CORRIDOR: 6,
  EXTRACT: 7,
  SPAWN: 8,
} as const;

const TS = 16;

function fillRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function noise(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  rng: () => number,
): void {
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      if (rng() > 0.85) {
        ctx.fillStyle = `rgba(0,0,0,${0.15 + rng() * 0.2})`;
        ctx.fillRect(x + px, y + py, 1, 1);
      }
    }
  }
}

function drawTileHubGround(ctx: CanvasRenderingContext2D, ox: number, oy: number): void {
  fillRect(ctx, ox, oy, TS, TS, "#1a1520");
  fillRect(ctx, ox + 2, oy + 10, TS - 4, 2, "#141018");
  noise(ctx, ox, oy, TS, TS, Math.random);
}

function drawTileHubPath(ctx: CanvasRenderingContext2D, ox: number, oy: number): void {
  fillRect(ctx, ox, oy, TS, TS, "#2a2230");
  for (let i = 0; i < 5; i++) {
    fillRect(ctx, ox + 2 + i * 3, oy + 4 + (i % 2) * 4, 2, 2, "#3a3240");
  }
}

function drawTileHubWall(ctx: CanvasRenderingContext2D, ox: number, oy: number): void {
  fillRect(ctx, ox, oy, TS, TS, "#3d3248");
  fillRect(ctx, ox, oy, TS, 3, "#4a3e58");
  fillRect(ctx, ox, oy + TS - 3, TS, 3, "#2a2238");
  fillRect(ctx, ox, oy, 3, TS, "#4a3e58");
}

function drawTileHubPlaza(ctx: CanvasRenderingContext2D, ox: number, oy: number): void {
  fillRect(ctx, ox, oy, TS, TS, "#252030");
  fillRect(ctx, ox + 1, oy + 1, TS - 2, TS - 2, "#2e2838");
}

function drawTileDungeonFloor(ctx: CanvasRenderingContext2D, ox: number, oy: number): void {
  fillRect(ctx, ox, oy, TS, TS, "#1e1814");
  fillRect(ctx, ox + 3, oy + 3, 4, 4, "#252018");
  fillRect(ctx, ox + 9, oy + 8, 3, 3, "#161210");
}

function drawTileDungeonWall(ctx: CanvasRenderingContext2D, ox: number, oy: number): void {
  fillRect(ctx, ox, oy, TS, TS, "#0e0c10");
  fillRect(ctx, ox + 2, oy + 2, TS - 4, TS - 4, "#1a1520");
  fillRect(ctx, ox + 4, oy + 4, 2, 2, "#2a2030");
  fillRect(ctx, ox + 10, oy + 6, 2, 2, "#2a2030");
}

function drawTileDungeonCorridor(ctx: CanvasRenderingContext2D, ox: number, oy: number): void {
  fillRect(ctx, ox, oy, TS, TS, "#181410");
  fillRect(ctx, ox, oy + 7, TS, 2, "#12100e");
}

function drawTileExtract(ctx: CanvasRenderingContext2D, ox: number, oy: number): void {
  drawTileDungeonFloor(ctx, ox, oy);
  fillRect(ctx, ox + 4, oy + 4, 8, 8, "#3d5a4a");
  fillRect(ctx, ox + 6, oy + 2, 4, 12, "#5a8a6a");
}

function drawTileSpawn(ctx: CanvasRenderingContext2D, ox: number, oy: number): void {
  drawTileDungeonFloor(ctx, ox, oy);
  fillRect(ctx, ox + 6, oy + 6, 4, 4, "#6a5a8a");
}

function drawPlayerFrame(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  frame: number,
  direction: number,
): void {
  const bob = frame === 0 ? 0 : frame % 2 === 0 ? 1 : 0;
  fillRect(ctx, ox + 4, oy + 6 + bob, 8, 8, "#3a2850");
  fillRect(ctx, ox + 5, oy + 7 + bob, 6, 6, "#4a3860");
  fillRect(ctx, ox + 6, oy + 3 + bob, 4, 4, "#c9b8a8");
  fillRect(ctx, ox + 5, oy + 2 + bob, 6, 2, "#5a4a70");

  if (frame > 0) {
    const leg = frame % 2 === 1;
    fillRect(ctx, ox + 5, oy + 13 + bob, 2, 3, leg ? "#2a2038" : "#3a2850");
    fillRect(ctx, ox + 9, oy + 13 + bob, 2, 3, leg ? "#3a2850" : "#2a2038");
  } else {
    fillRect(ctx, ox + 5, oy + 13 + bob, 2, 3, "#2a2038");
    fillRect(ctx, ox + 9, oy + 13 + bob, 2, 3, "#2a2038");
  }

  if (direction === 0) fillRect(ctx, ox + 7, oy + 12 + bob, 2, 1, "#9b6bff");
  if (direction === 1) fillRect(ctx, ox + 3, oy + 8 + bob, 1, 2, "#9b6bff");
  if (direction === 2) fillRect(ctx, ox + 12, oy + 8 + bob, 1, 2, "#9b6bff");
  if (direction === 3) fillRect(ctx, ox + 7, oy + 4 + bob, 2, 1, "#9b6bff");
}

function drawGoblinFrame(ctx: CanvasRenderingContext2D, ox: number, oy: number, frame: number): void {
  const bob = frame % 2;
  fillRect(ctx, ox + 3, oy + 6 + bob, 10, 8, "#2a5a30");
  fillRect(ctx, ox + 5, oy + 3 + bob, 6, 4, "#3a7a40");
  fillRect(ctx, ox + 4, oy + 2 + bob, 2, 2, "#e05050");
  fillRect(ctx, ox + 10, oy + 2 + bob, 2, 2, "#e05050");
}

function drawShamblerFrame(ctx: CanvasRenderingContext2D, ox: number, oy: number, frame: number): void {
  const bob = frame % 2 === 0 ? 0 : 1;
  fillRect(ctx, ox + 2, oy + 5 + bob, 12, 10, "#3a2838");
  fillRect(ctx, ox + 4, oy + 2 + bob, 8, 5, "#4a3848");
  fillRect(ctx, ox + 3, oy + 1 + bob, 3, 3, "#8a4040");
  fillRect(ctx, ox + 10, oy + 1 + bob, 3, 3, "#8a4040");
  fillRect(ctx, ox + 6, oy + 14 + bob, 4, 2, "#2a2030");
}

function addCanvasFrames(
  scene: Phaser.Scene,
  key: string,
  canvas: HTMLCanvasElement,
  frameWidth: number,
  frameHeight: number,
): void {
  scene.textures.addCanvas(key, canvas);
  const texture = scene.textures.get(key);
  const cols = Math.floor(canvas.width / frameWidth);
  const rows = Math.floor(canvas.height / frameHeight);
  let index = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      texture.add(index, 0, col * frameWidth, row * frameHeight, frameWidth, frameHeight);
      index++;
    }
  }
}

/** Canvas textures + explicit frames (addCanvas alone only exposes one full image). */
export function registerGameTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists("tiles")) return;

  const tileCount = 9;
  const tileCanvas = document.createElement("canvas");
  tileCanvas.width = TS * tileCount;
  tileCanvas.height = TS;
  const tctx = tileCanvas.getContext("2d", { willReadFrequently: true })!;

  const drawers = [
    drawTileHubGround,
    drawTileHubPath,
    drawTileHubWall,
    drawTileHubPlaza,
    drawTileDungeonFloor,
    drawTileDungeonWall,
    drawTileDungeonCorridor,
    drawTileExtract,
    drawTileSpawn,
  ];
  drawers.forEach((draw, i) => draw(tctx, i * TS, 0));
  addCanvasFrames(scene, "tiles", tileCanvas, TS, TS);

  const pCols = 4;
  const pRows = 4;
  const playerCanvas = document.createElement("canvas");
  playerCanvas.width = TS * pCols;
  playerCanvas.height = TS * pRows;
  const pctx = playerCanvas.getContext("2d", { willReadFrequently: true })!;

  for (let row = 0; row < pRows; row++) {
    for (let col = 0; col < pCols; col++) {
      drawPlayerFrame(pctx, col * TS, row * TS, col, row);
    }
  }
  addCanvasFrames(scene, "player", playerCanvas, TS, TS);

  const goblinCanvas = document.createElement("canvas");
  goblinCanvas.width = TS * 2;
  goblinCanvas.height = TS;
  const gctx = goblinCanvas.getContext("2d", { willReadFrequently: true })!;
  drawGoblinFrame(gctx, 0, 0, 0);
  drawGoblinFrame(gctx, TS, 0, 1);
  addCanvasFrames(scene, "goblin", goblinCanvas, TS, TS);

  const shamblerCanvas = document.createElement("canvas");
  shamblerCanvas.width = TS * 2;
  shamblerCanvas.height = TS;
  const sctx = shamblerCanvas.getContext("2d", { willReadFrequently: true })!;
  drawShamblerFrame(sctx, 0, 0, 0);
  drawShamblerFrame(sctx, TS, 0, 1);
  addCanvasFrames(scene, "shambler", shamblerCanvas, TS, TS);

  for (const key of ["tiles", "player", "goblin", "shambler"]) {
    scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
}

export function registerPlayerAnimations(scene: Phaser.Scene): void {
  if (scene.anims.exists("player-idle-down")) return;

  if (!scene.textures.exists("player")) {
    console.error("[dark-extract] player texture missing — animations skipped");
    return;
  }

  const dirs = ["down", "left", "right", "up"] as const;
  dirs.forEach((dir, row) => {
    scene.anims.create({
      key: `player-idle-${dir}`,
      frames: [{ key: "player", frame: row * 4 }],
      frameRate: 1,
      repeat: -1,
    });
    scene.anims.create({
      key: `player-walk-${dir}`,
      frames: [1, 2, 3].map((f) => ({ key: "player", frame: row * 4 + f })),
      frameRate: 8,
      repeat: -1,
    });
  });

  if (scene.textures.exists("goblin")) {
    scene.anims.create({
      key: "goblin-walk",
      frames: scene.anims.generateFrameNumbers("goblin", { start: 0, end: 1 }),
      frameRate: 6,
      repeat: -1,
    });
  }
  if (scene.textures.exists("shambler")) {
    scene.anims.create({
      key: "shambler-walk",
      frames: scene.anims.generateFrameNumbers("shambler", { start: 0, end: 1 }),
      frameRate: 4,
      repeat: -1,
    });
  }
}
