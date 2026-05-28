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
}

export type Facing = "up" | "down" | "left" | "right";

export interface HubSnapshot {
  players: PlayerState[];
  serverTime: number;
}
