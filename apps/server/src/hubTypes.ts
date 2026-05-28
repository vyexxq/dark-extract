import type { WebSocket } from "ws";
import type {
  PlayerId,
  PlayerInventory,
  PlayerProgression,
  PlayerProfile,
  PlayerState,
} from "@dark-extract/shared";
import type { StoredAccount } from "./store.js";

export interface HubClient {
  id: PlayerId;
  socket: WebSocket;
  state: PlayerState;
  inventory: PlayerInventory;
  progression: PlayerProgression;
  profile: PlayerProfile | null;
  account: StoredAccount | null;
  inDungeon: boolean;
  authToken: string | null;
}
