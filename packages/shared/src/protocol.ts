import type { PlayerInventory } from "./inventory.js";
import type { DungeonSnapshotEnemy, DungeonSnapshotPlayer } from "./dungeonSim.js";
import type {
  Facing,
  HubSnapshot,
  PartyInviteInfo,
  PartyState,
  PlayerId,
  PlayerProfile,
} from "./types.js";
import type { PlayerProgression } from "./progression.js";

/** Client → server messages */
export type ClientMessage =
  | { type: "register"; username: string; password: string }
  | { type: "login"; username: string; password: string }
  | { type: "auth_session"; token: string }
  | { type: "join"; name: string }
  | { type: "move"; x: number; y: number; facing: Facing }
  | { type: "ping"; t: number }
  | { type: "party_invite"; targetId: PlayerId }
  | { type: "party_accept"; inviteId: string }
  | { type: "party_decline"; inviteId: string }
  | { type: "party_leave" }
  | { type: "party_ready"; ready: boolean }
  | { type: "enter_dungeon" }
  | { type: "extract_dungeon"; runLoot: PlayerInventory }
  | { type: "abandon_dungeon"; reason: "death" | "flee" }
  | { type: "dungeon_move"; x: number; y: number; facing: Facing }
  | { type: "dungeon_slash"; angle: number }
  | { type: "dungeon_parry" };

/** Server → client messages */
export type ServerMessage =
  | { type: "auth_ok"; token: string; profile: PlayerProfile }
  | { type: "welcome"; playerId: PlayerId; name: string; profile?: PlayerProfile }
  | { type: "hub_snapshot"; snapshot: HubSnapshot }
  | { type: "party_update"; party: PartyState | null }
  | { type: "party_invite_received"; invite: PartyInviteInfo }
  | { type: "party_invite_resolved"; inviteId: string; accepted: boolean }
  | { type: "hub_notice"; message: string }
  | {
      type: "dungeon_start";
      instanceId: string;
      seed: number;
      width: number;
      height: number;
      party: boolean;
      players: DungeonSnapshotPlayer[];
      enemies: DungeonSnapshotEnemy[];
    }
  | {
      type: "dungeon_snapshot";
      instanceId: string;
      players: DungeonSnapshotPlayer[];
      enemies: DungeonSnapshotEnemy[];
      serverTime: number;
    }
  | { type: "dungeon_loot"; material: string; gold: number }
  | { type: "level_up"; progression: PlayerProgression }
  | { type: "inventory"; inventory: PlayerInventory; progression: PlayerProgression }
  | { type: "profile"; profile: PlayerProfile }
  | { type: "extract_ok"; inventory: PlayerInventory; progression: PlayerProgression; message: string }
  | { type: "dungeon_end"; message: string }
  | { type: "error"; message: string }
  | { type: "pong"; t: number };

export function parseClientMessage(raw: string): ClientMessage | null {
  try {
    const data = JSON.parse(raw) as ClientMessage;
    if (!data || typeof data !== "object" || !("type" in data)) return null;
    return data;
  } catch {
    return null;
  }
}

export function parseServerMessage(raw: string): ServerMessage | null {
  try {
    const data = JSON.parse(raw) as ServerMessage;
    if (!data || typeof data !== "object" || !("type" in data)) return null;
    return data;
  } catch {
    return null;
  }
}
