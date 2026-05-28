import {
  generateGoblinCaveTemplate,
  type ClientMessage,
  type DungeonSnapshotEnemy,
  type DungeonSnapshotPlayer,
  type Facing,
  type HubSnapshot,
  type PartyInviteInfo,
  type PartyState,
  type PlayerId,
  type PlayerInventory,
  type PlayerProfile,
  type PlayerProgression,
  parseServerMessage,
} from "@dark-extract/shared";

export type HubHandlers = {
  onWelcome: (playerId: PlayerId, name: string, profile: PlayerProfile | null) => void;
  onSnapshot: (snapshot: HubSnapshot) => void;
  onInventory: (inventory: PlayerInventory, progression: PlayerProgression) => void;
  onPartyUpdate: (party: PartyState | null) => void;
  onPartyInviteReceived: (invite: PartyInviteInfo) => void;
  onPartyInviteResolved: (inviteId: string, accepted: boolean) => void;
  onHubNotice: (message: string) => void;
  onDungeonStart: (payload: {
    instanceId: string;
    seed: number;
    width: number;
    height: number;
    party: boolean;
    players: DungeonSnapshotPlayer[];
    enemies: DungeonSnapshotEnemy[];
  }) => void;
  onDungeonSnapshot: (
    players: DungeonSnapshotPlayer[],
    enemies: DungeonSnapshotEnemy[],
  ) => void;
  onDungeonLoot: (material: string, gold: number) => void;
  onLevelUp: (progression: PlayerProgression) => void;
  onDungeonEnd: (message: string) => void;
  onExtractOk: (
    inventory: PlayerInventory,
    progression: PlayerProgression,
    message: string,
  ) => void;
  onError: (message: string) => void;
  onConnectionChange: (connected: boolean) => void;
};

const noop = () => {};

const INERT_HANDLERS: HubHandlers = {
  onWelcome: noop,
  onSnapshot: noop,
  onInventory: noop,
  onPartyUpdate: noop,
  onPartyInviteReceived: noop,
  onPartyInviteResolved: noop,
  onHubNotice: noop,
  onDungeonStart: noop,
  onDungeonSnapshot: noop,
  onDungeonLoot: noop,
  onLevelUp: noop,
  onDungeonEnd: noop,
  onExtractOk: noop,
  onError: noop,
  onConnectionChange: noop,
};

export class HubConnection {
  private socket: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connected = false;
  private handlers: HubHandlers = INERT_HANDLERS;
  private authed = false;

  constructor(
    private readonly wsUrl: string,
    private readonly authToken: string | null,
    private readonly guestName: string,
  ) {}

  setHandlers(handlers: HubHandlers): void {
    this.handlers = handlers;
  }

  clearHandlers(): void {
    this.handlers = INERT_HANDLERS;
  }

  connect(): void {
    if (this.socket?.readyState === WebSocket.OPEN) return;

    try {
      const socket = new WebSocket(this.wsUrl);
      this.socket = socket;
      this.authed = false;

      socket.onopen = () => {
        this.connected = true;
        this.handlers.onConnectionChange(true);
        if (this.authToken) {
          this.send({ type: "auth_session", token: this.authToken });
        } else {
          this.send({ type: "join", name: this.guestName });
        }
      };

      socket.onmessage = (event) => {
        const message = parseServerMessage(String(event.data));
        if (!message) return;

        switch (message.type) {
          case "auth_ok":
            this.authed = true;
            break;
          case "welcome":
            this.authed = true;
            this.handlers.onWelcome(message.playerId, message.name, message.profile ?? null);
            break;
          case "hub_snapshot":
            this.handlers.onSnapshot(message.snapshot);
            break;
          case "inventory":
            this.handlers.onInventory(message.inventory, message.progression);
            break;
          case "party_update":
            this.handlers.onPartyUpdate(message.party);
            break;
          case "party_invite_received":
            this.handlers.onPartyInviteReceived(message.invite);
            break;
          case "party_invite_resolved":
            this.handlers.onPartyInviteResolved(message.inviteId, message.accepted);
            break;
          case "hub_notice":
            this.handlers.onHubNotice(message.message);
            break;
          case "dungeon_start":
            this.handlers.onDungeonStart({
              instanceId: message.instanceId,
              seed: message.seed,
              width: message.width,
              height: message.height,
              party: message.party,
              players: message.players,
              enemies: message.enemies,
            });
            break;
          case "dungeon_snapshot":
            this.handlers.onDungeonSnapshot(message.players, message.enemies);
            break;
          case "dungeon_loot":
            this.handlers.onDungeonLoot(message.material, message.gold);
            break;
          case "level_up":
            this.handlers.onLevelUp(message.progression);
            break;
          case "dungeon_end":
            this.handlers.onDungeonEnd(message.message);
            break;
          case "extract_ok":
            this.handlers.onExtractOk(
              message.inventory,
              message.progression,
              message.message,
            );
            break;
          case "error":
            this.handlers.onError(message.message);
            break;
          case "pong":
            break;
        }
      };

      socket.onclose = () => {
        this.connected = false;
        this.authed = false;
        this.handlers.onConnectionChange(false);
        this.scheduleReconnect();
      };

      socket.onerror = () => socket.close();
    } catch {
      this.handlers.onConnectionChange(false);
      this.scheduleReconnect();
    }
  }

  disconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.socket?.close();
    this.socket = null;
    this.connected = false;
    this.clearHandlers();
  }

  isConnected(): boolean {
    return this.connected && this.authed;
  }

  sendMove(x: number, y: number, facing: Facing): void {
    this.send({ type: "move", x, y, facing });
  }

  partyInvite(targetId: PlayerId): void {
    this.send({ type: "party_invite", targetId });
  }

  partyLeave(): void {
    this.send({ type: "party_leave" });
  }

  partyReady(ready: boolean): void {
    this.send({ type: "party_ready", ready });
  }

  partyAccept(inviteId: string): void {
    this.send({ type: "party_accept", inviteId });
  }

  partyDecline(inviteId: string): void {
    this.send({ type: "party_decline", inviteId });
  }

  enterDungeon(): void {
    if (this.connected) {
      this.send({ type: "enter_dungeon" });
      return;
    }
    const preview = generateGoblinCaveTemplate(Date.now() >>> 0);
    this.handlers.onDungeonStart({
      instanceId: "local",
      seed: preview.seed,
      width: preview.width,
      height: preview.height,
      party: false,
      players: [],
      enemies: [],
    });
  }

  sendDungeonMove(x: number, y: number, facing: Facing): void {
    this.send({ type: "dungeon_move", x, y, facing });
  }

  sendDungeonSlash(angle: number): void {
    this.send({ type: "dungeon_slash", angle });
  }

  sendDungeonParry(): void {
    this.send({ type: "dungeon_parry" });
  }

  extractDungeon(runLoot: PlayerInventory): void {
    if (this.connected) {
      this.send({ type: "extract_dungeon", runLoot });
      return;
    }
    this.handlers.onExtractOk(
      runLoot,
      { level: 1, xp: 0 },
      "Extracted (offline — start server to save)",
    );
  }

  abandonDungeon(reason: "death" | "flee"): void {
    if (this.connected) {
      this.send({ type: "abandon_dungeon", reason });
    }
  }

  private send(message: ClientMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 2000);
  }
}

export function getOrCreateHubConnection(
  game: Phaser.Game,
  wsUrl: string,
  authToken: string | null,
  guestName: string,
): HubConnection {
  let conn = game.registry.get("hubConnection") as HubConnection | undefined;
  if (!conn) {
    conn = new HubConnection(wsUrl, authToken, guestName);
    game.registry.set("hubConnection", conn);
    conn.connect();
  }
  return conn;
}
