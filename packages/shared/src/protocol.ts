import type { PlayerInventory } from "./inventory.js";
import type { Facing, HubSnapshot, PlayerId } from "./types.js";

/** Client → server messages */
export type ClientMessage =
  | { type: "join"; name: string }
  | { type: "move"; x: number; y: number; facing: Facing }
  | { type: "ping"; t: number }
  | { type: "enter_dungeon" }
  | { type: "extract_dungeon"; runLoot: PlayerInventory }
  | { type: "abandon_dungeon"; reason: "death" | "flee" };

/** Server → client messages */
export type ServerMessage =
  | { type: "welcome"; playerId: PlayerId; name: string }
  | { type: "hub_snapshot"; snapshot: HubSnapshot }
  | { type: "dungeon_start"; seed: number; width: number; height: number }
  | { type: "inventory"; inventory: PlayerInventory }
  | { type: "extract_ok"; inventory: PlayerInventory; message: string }
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
