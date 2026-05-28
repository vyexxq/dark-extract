import { createServer } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import {
  DEFAULT_PROGRESSION,
  EMPTY_INVENTORY,
  HUB_HEIGHT_TILES,
  HUB_TICK_MS,
  HUB_WIDTH_TILES,
  TILE_SIZE,
  mergeInventory,
  parseClientMessage,
  type ClientMessage,
  type HubSnapshot,
  type PlayerId,
} from "@dark-extract/shared";
import {
  accountToProfile,
  loginUser,
  registerUser,
  resolveSession,
} from "./auth.js";
import {
  endDungeonInstance,
  getInstanceForPlayer,
  handleDungeonMove,
  handleDungeonParry,
  handleDungeonSlash,
  startDungeon,
  tickAllDungeons,
} from "./dungeonRoom.js";
import type { HubClient } from "./hubTypes.js";
import {
  createParty,
  dissolveParty,
  getPartyForPlayer,
  getPartyState,
  inviteToParty,
  leaveParty,
  partyAllReady,
  setReady,
} from "./party.js";
import { loadStore as loadAccountStore, updateAccount as persistAccount } from "./store.js";

// Re-export loadStore fix - I mistakenly imported loadStore from shared
// Fix imports in index.ts

const port = Number(process.env.PORT ?? 2567);
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
      .map((c) => ({
        ...c.state,
        level: c.profile?.progression.level ?? c.progression.level,
      })),
    serverTime: Date.now(),
  };
}

function sendInventory(client: HubClient): void {
  send(client.socket, {
    type: "inventory",
    inventory: client.inventory,
    progression: client.profile?.progression ?? client.progression,
  });
}

function playerNames(): Map<PlayerId, string> {
  const m = new Map<PlayerId, string>();
  for (const c of hubClients.values()) {
    m.set(c.id, c.state.name);
  }
  return m;
}

function broadcastParty(client: HubClient): void {
  const party = getPartyForPlayer(client.id);
  send(client.socket, {
    type: "party_update",
    party: party ? getPartyState(party, playerNames()) : null,
  });
}

function broadcastPartyAll(partyId: string): void {
  for (const c of hubClients.values()) {
    const p = getPartyForPlayer(c.id);
    if (p?.id === partyId) broadcastParty(c);
  }
}

function attachClient(
  socket: WebSocket,
  name: string,
  profile: HubClient["profile"],
  account: HubClient["account"],
  authToken: string | null,
): HubClient {
  const id = crypto.randomUUID();
  const spawnX = (HUB_WIDTH_TILES / 2) * TILE_SIZE;
  const spawnY = (HUB_HEIGHT_TILES / 2) * TILE_SIZE;
  const progression = profile?.progression ?? { ...DEFAULT_PROGRESSION };

  const client: HubClient = {
    id,
    socket,
    state: { id, name, x: spawnX, y: spawnY, facing: "down", level: progression.level },
    inventory: profile?.inventory
      ? {
          gold: profile.inventory.gold,
          materials: profile.inventory.materials.map((m) => ({ ...m })),
        }
      : { ...EMPTY_INVENTORY, materials: [] },
    progression: { ...progression },
    profile,
    account,
    inDungeon: false,
    authToken,
  };

  if (account) {
    client.inventory = {
      gold: account.inventory.gold,
      materials: account.inventory.materials.map((m) => ({ ...m })),
    };
    client.progression = { ...account.progression };
  }

  hubClients.set(id, client);
  send(socket, {
    type: "welcome",
    playerId: id,
    name,
    profile: profile ?? undefined,
  });
  sendInventory(client);
  broadcast({ type: "hub_snapshot", snapshot: buildSnapshot() });
  return client;
}

async function persistClientAccount(client: HubClient): Promise<void> {
  if (!client.account) return;
  client.account.progression = { ...client.progression };
  client.account.inventory = {
    gold: client.inventory.gold,
    materials: client.inventory.materials.map((m) => ({ ...m })),
  };
  await persistAccount(client.account);
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
    case "party_invite": {
      if (client.inDungeon) return;
      const target = hubClients.get(message.targetId);
      if (!target || target.inDungeon) {
        send(client.socket, { type: "error", message: "Player not available" });
        return;
      }
      let party = getPartyForPlayer(client.id);
      if (!party) party = createParty(client.id);
      if (party.leaderId !== client.id) {
        send(client.socket, { type: "error", message: "Only party leader can invite" });
        return;
      }
      if (!inviteToParty(party, target.id)) {
        send(client.socket, { type: "error", message: "Party is full" });
        return;
      }
      const state = getPartyState(party, playerNames());
      send(client.socket, { type: "party_update", party: state });
      send(target.socket, { type: "party_update", party: state });
      break;
    }
    case "party_accept": {
      break;
    }
    case "party_leave": {
      const party = getPartyForPlayer(client.id);
      if (party) {
        const pid = party.id;
        leaveParty(client.id);
        broadcastPartyAll(pid);
      }
      broadcastParty(client);
      break;
    }
    case "party_ready": {
      let party = getPartyForPlayer(client.id);
      if (!party) party = createParty(client.id);
      setReady(party, client.id, message.ready);
      const state = getPartyState(party, playerNames());
      for (const memberId of party.memberIds) {
        const member = hubClients.get(memberId);
        if (member) send(member.socket, { type: "party_update", party: state });
      }
      break;
    }
    case "party_start_dungeon": {
      const party = getPartyForPlayer(client.id);
      if (!party || party.leaderId !== client.id) {
        send(client.socket, { type: "error", message: "You are not party leader" });
        return;
      }
      if (!partyAllReady(party)) {
        send(client.socket, { type: "error", message: "All party members must ready up" });
        return;
      }
      const members = party.memberIds
        .map((id) => hubClients.get(id))
        .filter((c): c is HubClient => !!c && !c.inDungeon);
      if (members.length !== party.memberIds.length) {
        send(client.socket, { type: "error", message: "Party not in hub" });
        return;
      }
      dissolveParty(party.id);
      startDungeon(members, true);
      broadcast({ type: "hub_snapshot", snapshot: buildSnapshot() });
      break;
    }
    case "enter_dungeon": {
      if (client.inDungeon) return;
      const party = getPartyForPlayer(client.id);
      if (party && party.memberIds.length > 1) {
        send(client.socket, {
          type: "error",
          message: "Use party Start when grouped (everyone ready)",
        });
        return;
      }
      startDungeon([client], false);
      broadcast({ type: "hub_snapshot", snapshot: buildSnapshot() });
      break;
    }
    case "extract_dungeon": {
      if (!client.inDungeon) return;
      client.inDungeon = false;
      client.inventory = mergeInventory(client.inventory, message.runLoot);
      if (client.account) {
        client.account.inventory = client.inventory;
        void persistClientAccount(client);
      }
      send(client.socket, {
        type: "extract_ok",
        inventory: client.inventory,
        progression: client.progression,
        message: "Loot secured in town storage.",
      });
      sendInventory(client);
      broadcast({ type: "hub_snapshot", snapshot: buildSnapshot() });
      break;
    }
    case "abandon_dungeon": {
      if (!client.inDungeon) return;
      const inst = getInstanceForPlayer(client.id);
      if (inst) {
        endDungeonInstance(inst.id, message.reason === "death" ? "You died. Run loot lost." : "Run ended.");
      } else {
        client.inDungeon = false;
        const msg =
          message.reason === "death"
            ? "You died. Unextracted run loot was lost."
            : "You fled the dungeon.";
        send(client.socket, { type: "dungeon_end", message: msg });
      }
      broadcast({ type: "hub_snapshot", snapshot: buildSnapshot() });
      break;
    }
    case "dungeon_move": {
      const inst = getInstanceForPlayer(client.id);
      if (inst) handleDungeonMove(inst, client.id, message.x, message.y, message.facing);
      break;
    }
    case "dungeon_slash": {
      const inst = getInstanceForPlayer(client.id);
      if (inst) handleDungeonSlash(inst, client.id, message.angle);
      break;
    }
    case "dungeon_parry": {
      const inst = getInstanceForPlayer(client.id);
      if (inst) handleDungeonParry(inst, client.id);
      break;
    }
    case "ping":
      send(client.socket, { type: "pong", t: message.t });
      break;
    default:
      break;
  }
}

function removeClient(id: PlayerId): void {
  const client = hubClients.get(id);
  if (client) {
    leaveParty(id);
    const inst = getInstanceForPlayer(id);
    if (inst) endDungeonInstance(inst.id, "A hunter disconnected.");
    void persistClientAccount(client);
  }
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

await loadAccountStore();

httpServer.listen(port, "0.0.0.0", () => {
  console.log(`[dark-extract] Hub server on port ${port}`);
});

wss.on("connection", (socket) => {
  let client: HubClient | null = null;
  let authed = false;

  socket.on("message", async (data) => {
    const raw = data.toString();
    const message = parseClientMessage(raw);
    if (!message) {
      send(socket, { type: "error", message: "Invalid message" });
      return;
    }

    if (!authed) {
      try {
        if (message.type === "register") {
          const { token, profile } = await registerUser(message.username, message.password);
          const account = resolveSession(token)!;
          authed = true;
          send(socket, { type: "auth_ok", token, profile });
          client = attachClient(socket, profile.username, profile, account, token);
          return;
        }
        if (message.type === "login") {
          const { token, profile } = await loginUser(message.username, message.password);
          const account = resolveSession(token)!;
          authed = true;
          send(socket, { type: "auth_ok", token, profile });
          client = attachClient(socket, profile.username, profile, account, token);
          return;
        }
        if (message.type === "auth_session") {
          const account = resolveSession(message.token);
          if (!account) {
            send(socket, { type: "error", message: "Session expired — log in again" });
            return;
          }
          const profile = accountToProfile(account);
          authed = true;
          send(socket, { type: "auth_ok", token: message.token, profile });
          client = attachClient(socket, profile.username, profile, account, message.token);
          return;
        }
        if (message.type === "join") {
          authed = true;
          const name = message.name.trim().slice(0, 16) || "Hunter";
          client = attachClient(socket, name, null, null, null);
          return;
        }
        send(socket, { type: "error", message: "Register, login, or join first" });
      } catch (err) {
        send(socket, {
          type: "error",
          message: err instanceof Error ? err.message : "Auth failed",
        });
      }
      return;
    }

    if (!client) return;
    handleMessage(client, message);
  });

  socket.on("close", () => {
    if (client) removeClient(client.id);
  });
});

setInterval(() => {
  if (hubClients.size > 0) {
    broadcast({ type: "hub_snapshot", snapshot: buildSnapshot() });
  }
}, HUB_TICK_MS);

setInterval(() => {
  tickAllDungeons();
}, 50);
