import {
  TILE_SIZE,
  addMaterial,
  addXp,
  applySlashDamage,
  createEnemiesFromMap,
  generateGoblinCaveTemplate,
  maxHpForLevel,
  rollKillLoot,
  slashDamageForLevel,
  tickDungeonCombat,
  xpRewardForKill,
  DUNGEON_PARRY_WINDOW_MS,
  type DungeonEnemyState,
  type DungeonPlayerState,
  type DungeonSnapshotEnemy,
  type DungeonSnapshotPlayer,
  type DungeonMap,
  type PlayerId,
  type PlayerInventory,
} from "@dark-extract/shared";
import type { WebSocket } from "ws";
import type { HubClient } from "./hubTypes.js";
import { updateAccount } from "./store.js";

export interface DungeonInstance {
  id: string;
  map: DungeonMap;
  partyMode: boolean;
  memberIds: PlayerId[];
  players: Map<PlayerId, DungeonPlayerState>;
  enemies: DungeonEnemyState[];
  runLoot: Map<PlayerId, PlayerInventory>;
  sockets: Map<PlayerId, WebSocket>;
  clients: Map<PlayerId, HubClient>;
  ended: boolean;
  lastTick: number;
}

const instances = new Map<string, DungeonInstance>();
const playerInstance = new Map<PlayerId, string>();

function send(socket: WebSocket, message: unknown): void {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

function broadcastInstance(inst: DungeonInstance, message: unknown): void {
  const payload = JSON.stringify(message);
  for (const socket of inst.sockets.values()) {
    if (socket.readyState === socket.OPEN) socket.send(payload);
  }
}

function toSnapshotPlayers(inst: DungeonInstance): DungeonSnapshotPlayer[] {
  return [...inst.players.values()].map((p) => ({
    id: p.id,
    name: p.name,
    x: p.x,
    y: p.y,
    facing: p.facing,
    hp: p.hp,
    maxHp: p.maxHp,
    dead: p.dead,
  }));
}

function toSnapshotEnemies(inst: DungeonInstance): DungeonSnapshotEnemy[] {
  return inst.enemies.map((e) => ({
    id: e.id,
    kind: e.kind,
    x: e.x,
    y: e.y,
    hp: e.hp,
    maxHp: e.maxHp,
    dead: e.dead,
    phase: e.phase,
  }));
}

export function getInstanceForPlayer(playerId: PlayerId): DungeonInstance | undefined {
  const iid = playerInstance.get(playerId);
  if (!iid) return undefined;
  return instances.get(iid);
}

export function startDungeon(
  members: HubClient[],
  partyMode: boolean,
): DungeonInstance {
  for (const m of members) {
    const existing = playerInstance.get(m.id);
    if (existing) endDungeonInstance(existing, "Run cancelled");
  }

  const seed = (Date.now() ^ members.length * 31337) >>> 0;
  const map = generateGoblinCaveTemplate(seed);
  const id = crypto.randomUUID();
  const inst: DungeonInstance = {
    id,
    map,
    partyMode,
    memberIds: members.map((m) => m.id),
    players: new Map(),
    enemies: createEnemiesFromMap(map, members.length),
    runLoot: new Map(),
    sockets: new Map(),
    clients: new Map(),
    ended: false,
    lastTick: Date.now(),
  };

  for (const m of members) {
    const level = m.profile?.progression.level ?? 1;
    const maxHp = maxHpForLevel(level);
    inst.players.set(m.id, {
      id: m.id,
      name: m.state.name,
      x: map.spawn.x * TILE_SIZE + TILE_SIZE / 2,
      y: map.spawn.y * TILE_SIZE + TILE_SIZE / 2,
      facing: "down",
      hp: maxHp,
      maxHp,
      dead: false,
      parryUntil: 0,
      riposteUntil: 0,
    });
    inst.runLoot.set(m.id, { materials: [], gold: 0 });
    inst.sockets.set(m.id, m.socket);
    inst.clients.set(m.id, m);
    playerInstance.set(m.id, id);
    m.inDungeon = true;
  }

  instances.set(id, inst);

  const startMsg = {
    type: "dungeon_start" as const,
    instanceId: id,
    seed: map.seed,
    width: map.width,
    height: map.height,
    party: partyMode,
    players: toSnapshotPlayers(inst),
    enemies: toSnapshotEnemies(inst),
  };

  for (const m of members) {
    send(m.socket, startMsg);
  }

  return inst;
}

export function tickAllDungeons(): void {
  const now = Date.now();
  for (const inst of instances.values()) {
    if (inst.ended) continue;
    const dt = Math.min(0.1, (now - inst.lastTick) / 1000);
    inst.lastTick = now;

    const players = [...inst.players.values()];
    tickDungeonCombat(inst.map, players, inst.enemies, dt, now);

    broadcastInstance(inst, {
      type: "dungeon_snapshot",
      instanceId: inst.id,
      players: toSnapshotPlayers(inst),
      enemies: toSnapshotEnemies(inst),
      serverTime: now,
    });

    checkExtract(inst);
    if (players.every((p) => p.dead)) {
      endDungeonInstance(inst.id, "Party wiped. Run loot lost.");
    }
  }
}

function checkExtract(inst: DungeonInstance): void {
  const ex = inst.map.extract.x * TILE_SIZE + TILE_SIZE / 2;
  const ey = inst.map.extract.y * TILE_SIZE + TILE_SIZE / 2;
  const alive = [...inst.players.values()].filter((p) => !p.dead);
  if (alive.length === 0) return;

  const onTile = alive.filter((p) => Math.hypot(p.x - ex, p.y - ey) < 18);
  if (inst.partyMode) {
    if (onTile.length !== alive.length) return;
  } else if (onTile.length === 0) {
    return;
  }

  finishExtract(inst);
}

function finishExtract(inst: DungeonInstance): void {
  if (inst.ended) return;
  inst.ended = true;

  for (const [pid, client] of inst.clients) {
    const loot = inst.runLoot.get(pid) ?? { materials: [], gold: 0 };
    if (client.account) {
      client.account.inventory = mergeInv(client.account.inventory, loot);
      client.inventory = { ...client.account.inventory };
      client.profile = {
        accountId: client.account.id,
        username: client.account.username,
        progression: { ...client.account.progression },
        inventory: client.inventory,
      };
    } else {
      client.inventory = mergeInv(client.inventory, loot);
    }
    client.inDungeon = false;
    playerInstance.delete(pid);

    send(client.socket, {
      type: "extract_ok",
      inventory: client.inventory,
      progression: client.profile?.progression ?? client.progression,
      message: "Extracted! Loot secured.",
    });
    if (client.account) {
      void updateAccount(client.account);
    }
  }

  instances.delete(inst.id);
}

function mergeInv(base: PlayerInventory, run: PlayerInventory): PlayerInventory {
  let next = { ...base, gold: base.gold + run.gold, materials: base.materials.map((m) => ({ ...m })) };
  for (const s of run.materials) {
    next = addMaterial(next, s.id, s.qty);
  }
  return next;
}

export function endDungeonInstance(instanceId: string, message: string): void {
  const inst = instances.get(instanceId);
  if (!inst || inst.ended) return;
  inst.ended = true;

  for (const [pid, client] of inst.clients) {
    client.inDungeon = false;
    playerInstance.delete(pid);
    send(client.socket, { type: "dungeon_end", message });
  }
  instances.delete(instanceId);
}

export function handleDungeonMove(
  inst: DungeonInstance,
  playerId: PlayerId,
  x: number,
  y: number,
  facing: import("@dark-extract/shared").Facing,
): void {
  const p = inst.players.get(playerId);
  if (!p || p.dead || inst.ended) return;
  p.x = x;
  p.y = y;
  p.facing = facing;
}

export function handleDungeonSlash(
  inst: DungeonInstance,
  playerId: PlayerId,
  angle: number,
): void {
  const p = inst.players.get(playerId);
  if (!p || p.dead || inst.ended) return;

  const level = inst.clients.get(playerId)?.profile?.progression.level ?? 1;
  const riposte = p.riposteUntil > Date.now();
  const damage = slashDamageForLevel(level, riposte);
  if (riposte) p.riposteUntil = 0;

  const reach = 36;
  for (const enemy of inst.enemies) {
    if (enemy.dead) continue;
    const toEnemy = Math.atan2(enemy.y - p.y, enemy.x - p.x);
    const diff = Math.abs(Math.atan2(Math.sin(toEnemy - angle), Math.cos(toEnemy - angle)));
    const d = Math.hypot(enemy.x - p.x, enemy.y - p.y);
    if (d > reach || diff > 0.65) continue;

    const killed = applySlashDamage(enemy, damage);
    if (killed) {
      onEnemyKilled(inst, playerId, enemy);
    }
    break;
  }
}

export function handleDungeonParry(inst: DungeonInstance, playerId: PlayerId): void {
  const p = inst.players.get(playerId);
  if (!p || p.dead || inst.ended) return;
  p.parryUntil = Date.now() + DUNGEON_PARRY_WINDOW_MS;
}

function onEnemyKilled(
  inst: DungeonInstance,
  killerId: PlayerId,
  enemy: DungeonEnemyState,
): void {
  const loot = rollKillLoot(enemy.kind);
  const run = inst.runLoot.get(killerId) ?? { materials: [], gold: 0 };
  inst.runLoot.set(killerId, addMaterial(run, loot.material, 1));
  if (loot.gold) {
    const r = inst.runLoot.get(killerId)!;
    inst.runLoot.set(killerId, { ...r, gold: r.gold + loot.gold });
  }

  const client = inst.clients.get(killerId);
  if (client?.account) {
    const result = addXp(client.account.progression, xpRewardForKill(enemy.kind));
    client.account.progression = result.progression;
    if (client.profile) {
      client.profile.progression = { ...result.progression };
    }
    client.progression = { ...result.progression };
    if (result.leveledUp && result.newLevel) {
      send(client.socket, {
        type: "level_up",
        progression: result.progression,
      });
      const p = inst.players.get(killerId);
      if (p) {
        p.maxHp = maxHpForLevel(result.newLevel);
        p.hp = p.maxHp;
      }
    }
  }

  send(inst.sockets.get(killerId)!, {
    type: "dungeon_loot",
    material: loot.material,
    gold: loot.gold,
  });
}
