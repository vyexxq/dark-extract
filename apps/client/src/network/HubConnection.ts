import {
  generateDungeon,
  type ClientMessage,
  type Facing,
  type HubSnapshot,
  type PlayerId,
  type PlayerInventory,
  parseServerMessage,
} from "@dark-extract/shared";

export type HubHandlers = {
  onWelcome: (playerId: PlayerId, name: string) => void;
  onSnapshot: (snapshot: HubSnapshot) => void;
  onInventory: (inventory: PlayerInventory) => void;
  onDungeonStart: (seed: number, width: number, height: number) => void;
  onDungeonEnd: (message: string) => void;
  onExtractOk: (inventory: PlayerInventory, message: string) => void;
  onError: (message: string) => void;
  onConnectionChange: (connected: boolean) => void;
};

const noop = () => {};

const INERT_HANDLERS: HubHandlers = {
  onWelcome: noop,
  onSnapshot: noop,
  onInventory: noop,
  onDungeonStart: noop,
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

  constructor(
    private readonly wsUrl: string,
    private readonly playerName: string,
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

      socket.onopen = () => {
        this.connected = true;
        this.handlers.onConnectionChange(true);
        this.send({ type: "join", name: this.playerName });
      };

      socket.onmessage = (event) => {
        const message = parseServerMessage(String(event.data));
        if (!message) return;

        switch (message.type) {
          case "welcome":
            this.handlers.onWelcome(message.playerId, message.name);
            break;
          case "hub_snapshot":
            this.handlers.onSnapshot(message.snapshot);
            break;
          case "inventory":
            this.handlers.onInventory(message.inventory);
            break;
          case "dungeon_start":
            this.handlers.onDungeonStart(message.seed, message.width, message.height);
            break;
          case "dungeon_end":
            this.handlers.onDungeonEnd(message.message);
            break;
          case "extract_ok":
            this.handlers.onExtractOk(message.inventory, message.message);
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
    return this.connected;
  }

  sendMove(x: number, y: number, facing: Facing): void {
    this.send({ type: "move", x, y, facing });
  }

  enterDungeon(): void {
    if (this.connected) {
      this.send({ type: "enter_dungeon" });
      return;
    }
    const preview = generateDungeon(Date.now() >>> 0);
    this.handlers.onDungeonStart(preview.seed, preview.width, preview.height);
  }

  extractDungeon(runLoot: PlayerInventory): void {
    if (this.connected) {
      this.send({ type: "extract_dungeon", runLoot });
      return;
    }
    this.handlers.onExtractOk(runLoot, "Extracted (offline — start server to save)");
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
  playerName: string,
): HubConnection {
  let conn = game.registry.get("hubConnection") as HubConnection | undefined;
  if (!conn) {
    conn = new HubConnection(wsUrl, playerName);
    game.registry.set("hubConnection", conn);
    conn.connect();
  }
  return conn;
}
