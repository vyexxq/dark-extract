import type { PlayerProgression } from "./progression.js";
import type { PlayerInventory } from "./inventory.js";

export type PlayerId = string;

export type ZoneId = "hub" | "dungeon";

export interface Vec2 {
  x: number;
  y: number;
}

export interface PlayerState {
  id: PlayerId;
  name: string;
  x: number;
  y: number;
  facing: Facing;
  level: number;
}

export type Facing = "up" | "down" | "left" | "right";

export interface PlayerProfile {
  accountId: string;
  username: string;
  progression: PlayerProgression;
  inventory: PlayerInventory;
}

export interface HubSnapshot {
  players: PlayerState[];
  serverTime: number;
}

export interface PartyMemberInfo {
  playerId: PlayerId;
  name: string;
  ready: boolean;
  isLeader: boolean;
  atContract: boolean;
}

export interface PartyState {
  partyId: string;
  leaderId: PlayerId;
  members: PartyMemberInfo[];
}

export interface PartyInviteInfo {
  inviteId: string;
  fromPlayerId: PlayerId;
  fromName: string;
  partyId: string;
}
