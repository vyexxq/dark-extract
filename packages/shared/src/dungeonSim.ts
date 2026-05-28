import { TILE_SIZE } from "./constants.js";
import { isWalkableTile, tileAt, type DungeonMap } from "./dungeon.js";
import type { Facing } from "./types.js";

export type EnemyKind = "goblin" | "shambler";
export type EnemyPhase = "idle" | "telegraph" | "strike" | "stunned";

export interface EnemyDef {
  kind: EnemyKind;
  hp: number;
  speed: number;
  damage: number;
  telegraphSec: number;
  chaseRange: number;
}

export const ENEMY_DEFS: Record<EnemyKind, EnemyDef> = {
  goblin: {
    kind: "goblin",
    hp: 40,
    speed: 55,
    damage: 12,
    telegraphSec: 0.28,
    chaseRange: 90,
  },
  shambler: {
    kind: "shambler",
    hp: 68,
    speed: 34,
    damage: 18,
    telegraphSec: 0.36,
    chaseRange: 75,
  },
};

export interface DungeonEnemyState {
  id: string;
  kind: EnemyKind;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  dead: boolean;
  phase: EnemyPhase;
  phaseTimer: number;
  stunnedTimer: number;
  strikeHit: boolean;
  targetId: string | null;
}

export interface DungeonPlayerState {
  id: string;
  name: string;
  x: number;
  y: number;
  facing: Facing;
  hp: number;
  maxHp: number;
  dead: boolean;
  parryUntil: number;
  riposteUntil: number;
}

export interface DungeonSnapshotEnemy {
  id: string;
  kind: EnemyKind;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  dead: boolean;
  phase: EnemyPhase;
}

export interface DungeonSnapshotPlayer {
  id: string;
  name: string;
  x: number;
  y: number;
  facing: Facing;
  hp: number;
  maxHp: number;
  dead: boolean;
}

const MELEE_RANGE = 18;
const STRIKE_SEC = 0.08;
const STUN_SEC = 1.25;
const ATTACK_COOLDOWN_SEC = 0.85;
const PARRY_WINDOW_MS = 300;

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

function canWalk(map: DungeonMap, px: number, py: number): boolean {
  const tx = Math.floor(px / TILE_SIZE);
  const ty = Math.floor(py / TILE_SIZE);
  return isWalkableTile(tileAt(map, tx, ty));
}

function nearestLivingPlayer(
  players: DungeonPlayerState[],
  ex: number,
  ey: number,
): DungeonPlayerState | null {
  let best: DungeonPlayerState | null = null;
  let bestD = Infinity;
  for (const p of players) {
    if (p.dead) continue;
    const d = dist(ex, ey, p.x, p.y);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

export function createEnemiesFromMap(
  map: DungeonMap,
  partySize: number,
): DungeonEnemyState[] {
  const hpScale = 1 + (partySize - 1) * 0.35;
  return map.enemySpawns.map((spawn, i) => {
    const kind: EnemyKind = i % 2 === 0 ? "goblin" : "shambler";
    const def = ENEMY_DEFS[kind];
    const maxHp = Math.round(def.hp * hpScale);
    return {
      id: `e${i}`,
      kind,
      x: spawn.x * TILE_SIZE + TILE_SIZE / 2,
      y: spawn.y * TILE_SIZE + TILE_SIZE / 2,
      hp: maxHp,
      maxHp,
      dead: false,
      phase: "idle",
      phaseTimer: 0,
      stunnedTimer: 0,
      strikeHit: false,
      targetId: null,
    };
  });
}

export function tickDungeonCombat(
  map: DungeonMap,
  players: DungeonPlayerState[],
  enemies: DungeonEnemyState[],
  dt: number,
  now: number,
): void {
  const living = players.filter((p) => !p.dead);
  if (living.length === 0) return;

  for (const enemy of enemies) {
    if (enemy.dead) continue;

    const target =
      living.find((p) => p.id === enemy.targetId) ??
      nearestLivingPlayer(players, enemy.x, enemy.y);
    if (!target) continue;
    enemy.targetId = target.id;

    const d = dist(enemy.x, enemy.y, target.x, target.y);

    if (enemy.stunnedTimer > 0) {
      enemy.stunnedTimer -= dt;
      enemy.phase = "stunned";
      if (enemy.stunnedTimer <= 0) {
        enemy.phase = "idle";
        enemy.phaseTimer = 0;
      }
      continue;
    }

    const def = ENEMY_DEFS[enemy.kind];

    if (enemy.phase === "idle") {
      if (d < def.chaseRange && d > MELEE_RANGE) {
        const angle = Math.atan2(target.y - enemy.y, target.x - enemy.x);
        const speed = def.speed * dt;
        const nx = enemy.x + Math.cos(angle) * speed;
        const ny = enemy.y + Math.sin(angle) * speed;
        if (canWalk(map, nx, enemy.y)) enemy.x = nx;
        if (canWalk(map, enemy.x, ny)) enemy.y = ny;
      }
      if (d < MELEE_RANGE && enemy.phaseTimer <= 0) {
        enemy.phase = "telegraph";
        enemy.phaseTimer = 0;
        enemy.strikeHit = false;
      }
      if (enemy.phaseTimer > 0) enemy.phaseTimer -= dt;
    }

    if (enemy.phase === "telegraph") {
      enemy.phaseTimer += dt;
      if (enemy.phaseTimer >= def.telegraphSec) {
        enemy.phase = "strike";
        enemy.phaseTimer = 0;
      }
    }

    if (enemy.phase === "strike") {
      enemy.phaseTimer += dt;
      if (!enemy.strikeHit && enemy.phaseTimer >= STRIKE_SEC * 0.5) {
        if (d < MELEE_RANGE + 4) {
          if (target.parryUntil > now) {
            enemy.stunnedTimer = STUN_SEC;
            enemy.strikeHit = true;
            target.riposteUntil = now + 1400;
          } else {
            enemy.strikeHit = true;
            target.hp -= def.damage;
            if (target.hp <= 0) {
              target.hp = 0;
              target.dead = true;
            }
          }
        } else {
          enemy.strikeHit = true;
        }
      }
      if (enemy.phaseTimer >= STRIKE_SEC) {
        enemy.phase = "idle";
        enemy.phaseTimer = ATTACK_COOLDOWN_SEC;
      }
    }
  }
}

export function applySlashDamage(
  enemy: DungeonEnemyState,
  damage: number,
): boolean {
  if (enemy.dead) return false;
  enemy.hp -= damage;
  if (enemy.hp <= 0) {
    enemy.hp = 0;
    enemy.dead = true;
    return true;
  }
  return false;
}

export function rollKillLoot(kind: EnemyKind): {
  material: "goblin_tooth" | "cave_moss" | "iron_shard";
  gold: number;
} {
  if (kind === "shambler") {
    return { material: "iron_shard", gold: Math.random() > 0.5 ? 1 : 0 };
  }
  return {
    material: Math.random() > 0.5 ? "goblin_tooth" : "cave_moss",
    gold: Math.random() > 0.65 ? 1 : 0,
  };
}

export const DUNGEON_PARRY_WINDOW_MS = PARRY_WINDOW_MS;
