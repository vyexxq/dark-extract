import { createServer } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import {
  DUNGEON_HEIGHT_TILES,
  DUNGEON_WIDTH_TILES,
  DEFAULT_WS_PORT,
  EMPTY_INVENTORY,
  HUB_HEIGHT_TILES,
  HUB_TICK_MS,
  HUB_WIDTH_TILES,
  TILE_SIZE,
  mergeInventory,
  type ClientMessage,
  type HubSnapshot,
  type PlayerId,
  type PlayerInventory,
  type PlayerState,
  parseClientMessage,
} from "@dark-extract/shared";

interface HubClient {
  id: PlayerId;
  socket: WebSocket;
  state: PlayerState;
  inventory: PlayerInventory;
  inDungeon: boolean;
}

const port = Number(process.env.PORT ?? DEFAULT_WS_PORT);
const hubClients = new Map<PlayerId, HubClient>();

function clampHubPosition(x: number, y: number): { x: number; y: number } {
  const maxX = HUB_WIDTH_TILES * TILE_SIZE - TILE_SIZE;
  const maxY = HUB_HEIGHT_TILES * TILE_SIZE - TILE_SIZE;
  return {
    x: Math.max(0, Math.min(maxX, x)),
    y: Math.max(0, Math.min(maxY, y)),
  };
}

function send(socket: WebSocket, message: unknown): void {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

function broadcast(message: unknown): void {
  const payload = JSON.stringify(message);
  for (const client of hubClients.values()) {
    if (client.socket.readyState === client.socket.OPEN) {
      client.socket.send(payload);
    }
  }
}

function buildSnapshot(): HubSnapshot {
  return {
    players: [...hubClients.values()]
      .filter((c) => !c.inDungeon)
      .map((c) => ({ ...c.state })),
    serverTime: Date.now(),
  };
}

function sendInventory(client: HubClient): void {
  send(client.socket, { type: "inventory", inventory: client.inventory });
}

function handleMessage(client: HubClient, message: ClientMessage): void {
  switch (message.type) {
    case "move": {
      if (client.inDungeon) return;
      const { x, y } = clampHubPosition(message.x, message.y);
      client.state.x = x;
      client.state.y = y;
      client.state.facing = message.facing;
      break;
    }
    case "enter_dungeon": {
      if (client.inDungeon) return;
      client.inDungeon = true;
      const seed = (Date.now() ^ (client.id.charCodeAt(0) * 997)) >>> 0;
      send(client.socket, {
        type: "dungeon_start",
        seed,
        width: DUNGEON_WIDTH_TILES,
        height: DUNGEON_HEIGHT_TILES,
      });
      broadcast({ type: "hub_snapshot", snapshot: buildSnapshot() });
      break;
    }
    case "extract_dungeon": {
      if (!client.inDungeon) return;
      client.inDungeon = false;
      client.inventory = mergeInventory(client.inventory, message.runLoot);
      send(client.socket, {
        type: "extract_ok",
        inventory: client.inventory,
        message: "Loot secured in town storage.",
      });
      sendInventory(client);
      broadcast({ type: "hub_snapshot", snapshot: buildSnapshot() });
      break;
    }
    case "abandon_dungeon": {
      if (!client.inDungeon) return;
      client.inDungeon = false;
      const msg =
        message.reason === "death"
          ? "You died. Unextracted run loot was lost."
          : "You fled the dungeon.";
      send(client.socket, { type: "dungeon_end", message: msg });
      broadcast({ type: "hub_snapshot", snapshot: buildSnapshot() });
      break;
    }
    case "ping":
      send(client.socket, { type: "pong", t: message.t });
      break;
    case "join":
      break;
  }
}

function removeClient(id: PlayerId): void {
  hubClients.delete(id);
  broadcast({ type: "hub_snapshot", snapshot: buildSnapshot() });
}

const httpServer = createServer((req, res) => {
  const path = req.url?.split("?")[0] ?? "";
  if (path === "/" || path === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, service: "dark-extract-hub" }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server: httpServer });

httpServer.listen(port, "0.0.0.0", () => {
  console.log(
    `[dark-extract] Hub server on port ${port} (health /, ws://localhost:${port} local)`,
  );
});

wss.on("connection", (socket) => {
  let client: HubClient | null = null;

  socket.on("message", (data) => {
    const raw = data.toString();
    const message = parseClientMessage(raw);
    if (!message) {
      send(socket, { type: "error", message: "Invalid message" });
      return;
    }

    if (!client && message.type === "join") {
      const id = crypto.randomUUID();
      const spawnX = (HUB_WIDTH_TILES / 2) * TILE_SIZE;
      const spawnY = (HUB_HEIGHT_TILES / 2) * TILE_SIZE;
      const name = message.name.trim().slice(0, 16) || "Hunter";

      client = {
        id,
        socket,
        state: { id, name, x: spawnX, y: spawnY, facing: "down" },
        inventory: { ...EMPTY_INVENTORY, materials: [] },
        inDungeon: false,
      };
      hubClients.set(id, client);
      send(socket, { type: "welcome", playerId: id, name });
      sendInventory(client);
      broadcast({ type: "hub_snapshot", snapshot: buildSnapshot() });
      return;
    }

    if (!client) {
      send(socket, { type: "error", message: "Send join first" });
      return;
    }

    handleMessage(client, message);
  });

  socket.on("close", () => {
    if (client) removeClient(client.id);
  });
});

setInterval(() => {
  if (hubClients.size === 0) return;
  broadcast({ type: "hub_snapshot", snapshot: buildSnapshot() });
}, HUB_TICK_MS);

