import Phaser from "phaser";
import {
  HUB_HEIGHT_TILES,
  HUB_WIDTH_TILES,
  isNearHubContracts,
  PLAYER_SPEED,
  TILE_SIZE,
  xpProgressInLevel,
  type Facing,
  type PartyInviteInfo,
  type PartyState,
  type PlayerId,
  type PlayerInventory,
  type PlayerProgression,
  type PlayerState,
} from "@dark-extract/shared";
import { getOrCreateHubConnection, type HubConnection } from "../../network/HubConnection";
import { PlayerSprite } from "../entities/PlayerSprite";
import { CONTRACTS_TILE, getHubTileIndex } from "../hub/hubLayout";
import { createMovementKeys, readMovement, type MovementKeys } from "../input/createMovementKeys";
import { renderTileGrid } from "../map/renderTilemap";
import { ContractPanel } from "../ui/ContractPanel";
import { HubLobbyPanel } from "../ui/HubLobbyPanel";
import { PartyInviteModal } from "../ui/PartyInviteModal";

const WORLD_W = HUB_WIDTH_TILES * TILE_SIZE;
const WORLD_H = HUB_HEIGHT_TILES * TILE_SIZE;

type HubReturnData = {
  inventory?: PlayerInventory;
  statusMsg?: string;
};

export class HubScene extends Phaser.Scene {
  private connection!: HubConnection;
  private localId: PlayerId = "local";
  private networkId: PlayerId | null = null;
  private sprites = new Map<PlayerId, PlayerSprite>();
  private labels = new Map<PlayerId, Phaser.GameObjects.Text>();
  private movementKeys: MovementKeys | null = null;
  private interactKey: Phaser.Input.Keyboard.Key | null = null;
  private ready = false;
  private localPos = { x: WORLD_W / 2, y: WORLD_H / 2 };
  private facing: Facing = "down";
  private lastSent = 0;
  private moving = false;
  private inventory: PlayerInventory = { materials: [], gold: 0 };
  private hudText: Phaser.GameObjects.Text | null = null;
  private promptText: Phaser.GameObjects.Text | null = null;
  private statusText: Phaser.GameObjects.Text | null = null;
  private canEnterDungeon = false;
  private party: PartyState | null = null;
  private progression: PlayerProgression = { level: 1, xp: 0 };
  private readyKey: Phaser.Input.Keyboard.Key | null = null;
  private tabKey: Phaser.Input.Keyboard.Key | null = null;
  private lobbyPanel!: HubLobbyPanel;
  private contractPanel!: ContractPanel;
  private inviteModal!: PartyInviteModal;
  private pendingInvites: PartyInviteInfo[] = [];
  private hubRoster: PlayerState[] = [];
  private acceptKey: Phaser.Input.Keyboard.Key | null = null;
  private declineKey: Phaser.Input.Keyboard.Key | null = null;
  private contractGlow: Phaser.GameObjects.Rectangle | null = null;

  constructor() {
    super({ key: "HubScene" });
  }

  init(data?: HubReturnData): void {
    this.registry.set("inDungeon", false);
    if (data?.inventory) {
      this.inventory = data.inventory;
      this.registry.set("hubInventory", data.inventory);
    } else {
      const stored = this.registry.get("hubInventory") as PlayerInventory | undefined;
      if (stored) this.inventory = stored;
    }
    const prog = this.registry.get("playerProgression") as PlayerProgression | undefined;
    if (prog) this.progression = prog;
    if (data?.statusMsg) {
      this.registry.set("hubStatusMsg", data.statusMsg);
    }
  }

  create(): void {
    this.resetHubState();

    const wsUrl = (this.registry.get("wsUrl") as string) ?? "ws://localhost:2567";
    const playerName = (this.registry.get("playerName") as string) ?? "Hunter";
    const authToken = (this.registry.get("authToken") as string | null) ?? null;

    if (!this.textures.exists("tiles")) {
      this.add
        .text(320, 240, "Loading failed — check browser console (F12)", {
          fontSize: "14px",
          color: "#e8a84a",
          align: "center",
          wordWrap: { width: 400 },
        })
        .setOrigin(0.5);
      return;
    }

    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.setZoom(2);
    this.cameras.main.setBackgroundColor("#0a080c");

    renderTileGrid(this, "tiles", HUB_WIDTH_TILES, HUB_HEIGHT_TILES, getHubTileIndex, 0);
    this.drawLandmarks();
    this.drawAtmosphere();

    const savedId = this.registry.get("networkPlayerId") as PlayerId | undefined;
    this.localId = savedId ?? "local";
    this.networkId = savedId ?? null;
    this.ensureLocalPlayer();

    if (!this.input.keyboard) {
      this.add.text(320, 260, "Keyboard unavailable", { fontSize: "12px", color: "#e8a84a" }).setOrigin(0.5);
      return;
    }
    this.movementKeys = createMovementKeys(this.input.keyboard);
    this.interactKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.readyKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
    this.tabKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TAB);
    this.acceptKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Y);
    this.declineKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.N);

    this.lobbyPanel = new HubLobbyPanel(this);
    this.contractPanel = new ContractPanel(this);
    this.inviteModal = new PartyInviteModal(this);
    this.inviteModal.setHandlers(
      (inviteId) => this.connection.partyAccept(inviteId),
      (inviteId) => this.connection.partyDecline(inviteId),
    );
    this.lobbyPanel.setInviteHandler((targetId) => {
      this.connection.partyInvite(targetId);
      this.setStatus("Invite sent — they must accept");
    });
    this.lobbyPanel.setLeaveHandler(() => {
      this.connection.partyLeave();
      this.setStatus("Left party");
    });

    this.hudText = this.add
      .text(8, 8, "", { fontSize: "9px", color: "#8a7f96", fontFamily: "monospace" })
      .setScrollFactor(0)
      .setDepth(200);

    this.promptText = this.add
      .text(320, 440, "", { fontSize: "10px", color: "#e8a84a", fontFamily: "monospace" })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(200);

    this.statusText = this.add
      .text(8, 20, "Click game · WASD move", { fontSize: "9px", color: "#c4b5fd", fontFamily: "monospace" })
      .setScrollFactor(0)
      .setDepth(200);

    this.connection = getOrCreateHubConnection(this.game, wsUrl, authToken, playerName);
    this.registry.set("connection", this.connection);

    this.connection.setHandlers({
      onWelcome: (id, _name, profile) => {
        if (!this.scene.isActive()) return;
        this.registry.set("networkPlayerId", id);
        this.networkId = id;
        if (profile) {
          this.inventory = profile.inventory;
          this.progression = profile.progression;
          this.registry.set("hubInventory", profile.inventory);
          this.registry.set("playerProgression", profile.progression);
        }
        if (this.localId !== id) {
          this.migrateLocalId(id);
        }
        this.removeDuplicateSelfSprites(id);
        this.lobbyPanel.setMyId(id);
        this.setStatus("Connected");
        this.updateHud();
      },
      onSnapshot: (snapshot) => {
        if (!this.scene.isActive()) return;
        this.hubRoster = snapshot.players;
        this.syncPlayers(snapshot.players);
        if (this.lobbyPanel.isOpen()) {
          this.refreshLobbyPanel();
        }
      },
      onInventory: (inv, prog) => {
        this.inventory = inv;
        this.progression = prog;
        this.registry.set("hubInventory", inv);
        this.registry.set("playerProgression", prog);
        if (this.scene.isActive()) this.updateHud();
      },
      onPartyUpdate: (party) => {
        this.party = party;
        if (this.scene.isActive()) {
          this.updateHud();
          this.refreshContractUi();
          if (this.lobbyPanel.isOpen()) this.refreshLobbyPanel();
        }
      },
      onPartyInviteReceived: (invite) => {
        if (!this.scene.isActive()) return;
        this.pendingInvites.push(invite);
        this.inviteModal.show(invite);
        this.setStatus(`${invite.fromName} invited you — [Y] accept · [N] decline`);
      },
      onPartyInviteResolved: (inviteId, accepted) => {
        this.pendingInvites = this.pendingInvites.filter((i) => i.inviteId !== inviteId);
        if (this.inviteModal.getInviteId() === inviteId) {
          this.inviteModal.hide();
        }
        if (this.scene.isActive() && accepted) {
          this.setStatus("Party member joined");
        }
      },
      onHubNotice: (msg) => {
        if (this.scene.isActive()) this.setStatus(msg);
      },
      onDungeonStart: (payload) => {
        if (!this.scene.isActive()) return;
        this.ready = false;
        this.clearAllPlayers();
        this.connection.clearHandlers();
        this.scene.start("DungeonScene", {
          seed: payload.seed,
          width: payload.width,
          height: payload.height,
          inventory: this.inventory,
          party: payload.party,
          instanceId: payload.instanceId,
          players: payload.players,
          enemies: payload.enemies,
        });
      },
      onDungeonEnd: (msg) => {
        this.registry.set("hubStatusMsg", msg);
      },
      onExtractOk: (inv, prog, msg) => {
        this.inventory = inv;
        this.progression = prog;
        this.registry.set("hubInventory", inv);
        this.registry.set("playerProgression", prog);
        this.registry.set("hubStatusMsg", msg);
      },
      onLevelUp: () => {},
      onDungeonSnapshot: () => {},
      onDungeonLoot: () => {},
      onError: (msg) => {
        if (this.scene.isActive()) this.setStatus(`Error: ${msg}`);
      },
      onConnectionChange: (connected) => {
        if (this.scene.isActive()) {
          this.setStatus(connected ? "Online" : "Offline — solo dungeons use local seed");
        }
      },
    });

    this.input.on("pointerdown", () => {
      this.game.canvas.focus();
    });

    if (this.game.canvas instanceof HTMLCanvasElement) {
      this.game.canvas.tabIndex = 0;
      this.game.canvas.style.outline = "none";
    }

    this.cameras.main.centerOn(this.localPos.x, this.localPos.y);
    this.ready = true;
    this.updateHud();

    const pendingStatus = this.registry.get("hubStatusMsg") as string | undefined;
    if (pendingStatus) {
      this.setStatus(pendingStatus);
      this.registry.remove("hubStatusMsg");
    }

    this.removeDuplicateSelfSprites(this.localId);

    const existingNetId = this.registry.get("networkPlayerId") as PlayerId | undefined;
    if (existingNetId) {
      this.networkId = existingNetId;
      this.localId = existingNetId;
      this.lobbyPanel.setMyId(existingNetId);
    }
  }

  update(_time: number, delta: number): void {
    if (!this.ready || !this.movementKeys) return;

    if (this.tabKey && Phaser.Input.Keyboard.JustDown(this.tabKey)) {
      const open = this.lobbyPanel.toggle();
      if (open) this.refreshLobbyPanel();
    }

    if (this.inviteModal.isOpen()) {
      if (this.acceptKey && Phaser.Input.Keyboard.JustDown(this.acceptKey)) {
        const id = this.inviteModal.getInviteId();
        if (id) this.connection.partyAccept(id);
        this.inviteModal.hide();
      }
      if (this.declineKey && Phaser.Input.Keyboard.JustDown(this.declineKey)) {
        const id = this.inviteModal.getInviteId();
        if (id) this.connection.partyDecline(id);
        this.inviteModal.hide();
      }
    }

    if (this.lobbyPanel.isOpen()) {
      this.promptText?.setText("[Tab] close lobby");
      return;
    }

    const { dx, dy } = readMovement(this.movementKeys);
    this.moving = dx !== 0 || dy !== 0;

    if (this.moving) {
      const len = Math.hypot(dx, dy) || 1;
      const speed = (PLAYER_SPEED * delta) / 1000;
      this.localPos.x = Phaser.Math.Clamp(this.localPos.x + (dx / len) * speed, 8, WORLD_W - 8);
      this.localPos.y = Phaser.Math.Clamp(this.localPos.y + (dy / len) * speed, 8, WORLD_H - 8);

      if (Math.abs(dx) > Math.abs(dy)) {
        this.facing = dx < 0 ? "left" : "right";
      } else {
        this.facing = dy < 0 ? "up" : "down";
      }
    }

    const localSprite = this.sprites.get(this.localId);
    const localLabel = this.labels.get(this.localId);
    if (localSprite?.active) {
      localSprite.setPosition(this.localPos.x, this.localPos.y);
      localSprite.updateAnimation(this.facing, this.moving);
      localLabel?.setPosition(localSprite.x, localSprite.y - 8);
      this.cameras.main.startFollow(localSprite, true, 0.12, 0.12);
    }

    this.canEnterDungeon = isNearHubContracts(this.localPos.x, this.localPos.y);
    const myId = this.myNetworkId();
    this.contractGlow?.setVisible(this.canEnterDungeon);

    if (this.readyKey && Phaser.Input.Keyboard.JustDown(this.readyKey)) {
      const inParty = this.party && this.party.members.length > 1;
      if (inParty) {
        if (!this.canEnterDungeon) {
          this.setStatus("Stand at the Contracts board to ready up");
        } else {
          const me = this.party?.members.find((m) => m.playerId === myId);
          this.connection.partyReady(!me?.ready);
        }
      }
    }

    this.refreshContractUi();

    if (this.canEnterDungeon && this.interactKey && Phaser.Input.Keyboard.JustDown(this.interactKey)) {
      this.connection.enterDungeon();
    } else if (!this.canEnterDungeon) {
      const partyHint =
        this.party && this.party.members.length > 1
          ? " · meet at Contracts to ready"
          : "";
      this.promptText?.setText(`[Tab] hunter lobby${partyHint}`);
    }

    const now = this.time.now;
    if (this.networkId && now - this.lastSent > 50) {
      this.lastSent = now;
      this.connection.sendMove(this.localPos.x, this.localPos.y, this.facing);
    }
  }

  shutdown(): void {
    this.ready = false;
    this.connection?.clearHandlers();
    this.clearAllPlayers();
  }

  private resetHubState(): void {
    this.ready = false;
    this.clearAllPlayers();
    this.localPos = { x: WORLD_W / 2, y: WORLD_H / 2 };
    this.facing = "down";
    this.lastSent = 0;
    this.moving = false;
  }

  private clearAllPlayers(): void {
    for (const sprite of this.sprites.values()) {
      if (sprite.active) sprite.destroy();
    }
    for (const label of this.labels.values()) {
      if (label.active) label.destroy();
    }
    this.sprites.clear();
    this.labels.clear();
  }

  private ensureLocalPlayer(): void {
    if (this.sprites.has(this.localId)) return;
    const sprite = new PlayerSprite(this, this.localPos.x, this.localPos.y, 0x9b6bff);
    this.sprites.set(this.localId, sprite);
    const label = this.add
      .text(this.localPos.x, this.localPos.y - 12, this.registry.get("playerName") ?? "Hunter", {
        fontSize: "8px",
        color: "#c4b5fd",
        fontFamily: "monospace",
      })
      .setOrigin(0.5, 1)
      .setDepth(21);
    this.labels.set(this.localId, label);
  }

  private migrateLocalId(newId: PlayerId): void {
    const sprite = this.sprites.get(this.localId);
    const label = this.labels.get(this.localId);
    if (sprite) {
      this.sprites.delete(this.localId);
      this.sprites.set(newId, sprite);
    }
    if (label) {
      this.labels.delete(this.localId);
      this.labels.set(newId, label);
    }
    this.localId = newId;
  }

  private setStatus(msg: string): void {
    if (!this.statusText?.active) return;
    this.statusText.setText(msg);
  }

  private updateHud(): void {
    if (!this.hudText?.active) return;
    const mats = this.inventory.materials.map((m) => `${m.id}:${m.qty}`).join(" ") || "none";
    const xp = xpProgressInLevel(this.progression);
    const partyTxt = this.party
      ? ` · party ${this.party.members.length} (${this.party.members.filter((m) => m.ready).length} ready)`
      : "";
    this.hudText.setText(
      `Lv${this.progression.level} XP ${xp.current}/${xp.needed} · ${mats} · gold ${this.inventory.gold}${partyTxt}`,
    );
  }

  private myNetworkId(): PlayerId {
    return (
      (this.registry.get("networkPlayerId") as PlayerId | undefined) ??
      this.networkId ??
      this.localId
    );
  }

  private refreshContractUi(): void {
    const myId = this.myNetworkId();
    const solo = !this.party || this.party.members.length < 2;
    this.contractPanel.refresh(this.party, myId, this.canEnterDungeon, solo);
    if (this.canEnterDungeon) {
      const inParty = this.party && this.party.members.length > 1;
      const isLeader = this.party?.leaderId === myId;
      const allReady = this.party?.members.every((m) => m.ready);
      const allHere = this.party?.members.every((m) => m.atContract);
      if (inParty && isLeader && allReady && allHere) {
        this.promptText?.setText("[E] Sign contract — start Goblin Cave");
      } else if (inParty) {
        this.promptText?.setText("[R] ready at board · leader [E] when everyone is ready");
      } else {
        this.promptText?.setText("[E] Enter cave solo · [Tab] invite friends first");
      }
    }
  }

  private refreshLobbyPanel(): void {
    const myId = this.myNetworkId();
    this.lobbyPanel.setMyId(myId);
    this.lobbyPanel.refresh(
      (this.registry.get("playerName") as string) ?? "Hunter",
      this.progression,
      this.inventory,
      this.party,
      this.hubRoster,
    );
  }

  private drawLandmarks(): void {
    const cx = CONTRACTS_TILE.tx * TILE_SIZE + TILE_SIZE / 2;
    const cy = CONTRACTS_TILE.ty * TILE_SIZE + TILE_SIZE / 2;
    this.contractGlow = this.add
      .rectangle(cx, cy, 36, 28, 0xe8a84a, 0.12)
      .setStrokeStyle(1, 0xe8a84a, 0.35)
      .setDepth(4)
      .setVisible(false);
    this.add.rectangle(cx, cy, 28, 20, 0x4a3a5c, 0.6).setDepth(5);
    this.add
      .text(cx, cy - 22, "Contracts", { fontSize: "8px", color: "#d8d0e0", fontFamily: "monospace" })
      .setOrigin(0.5)
      .setDepth(6);
    this.add
      .text(8 * TILE_SIZE, 22 * TILE_SIZE - 20, "Forge", { fontSize: "8px", color: "#c9a070", fontFamily: "monospace" })
      .setOrigin(0.5);
    this.add
      .text(30 * TILE_SIZE, 22 * TILE_SIZE - 18, "Market", { fontSize: "8px", color: "#8a7f96", fontFamily: "monospace" })
      .setOrigin(0.5);
  }

  private drawAtmosphere(): void {
    const torchPositions = [[10, 10], [30, 10], [10, 20], [30, 20], [20, 15]];
    for (const [tx, ty] of torchPositions) {
      const x = tx * TILE_SIZE;
      const y = ty * TILE_SIZE;
      const light = this.add.circle(x, y, 28, 0xe8a84a, 0.08).setDepth(2);
      this.tweens.add({
        targets: light,
        alpha: { from: 0.06, to: 0.12 },
        duration: 1200 + Math.random() * 600,
        yoyo: true,
        repeat: -1,
      });
    }
  }

  private isSelfPlayer(player: PlayerState): boolean {
    const netId = this.registry.get("networkPlayerId") as PlayerId | undefined;
    const myName = this.registry.get("playerName") as string | undefined;
    return (
      player.id === this.localId ||
      player.id === this.networkId ||
      (!!netId && player.id === netId) ||
      (!!myName && player.name === myName)
    );
  }

  /** Remove ghost copies of our character (uuid + local placeholder). */
  private removeDuplicateSelfSprites(keepId: PlayerId): void {
    const myName = this.registry.get("playerName") as string | undefined;
    for (const [id, sprite] of [...this.sprites.entries()]) {
      if (id === keepId) continue;
      const label = this.labels.get(id);
      const isSelfLabel = label?.text === myName;
      const isSelfId = id === "local" || id === this.networkId;
      if (isSelfId || isSelfLabel) {
        if (sprite.active) sprite.destroy();
        label?.destroy();
        this.sprites.delete(id);
        this.labels.delete(id);
      }
    }
    this.localId = keepId;
    if (!this.sprites.has(keepId)) {
      this.ensureLocalPlayer();
    }
  }

  private syncPlayers(players: PlayerState[]): void {
    if (!this.scene.isActive()) return;

    const seen = new Set<PlayerId>();
    seen.add(this.localId);

    for (const player of players) {
      if (this.isSelfPlayer(player)) {
        seen.add(player.id);
        continue;
      }
      seen.add(player.id);

      let sprite = this.sprites.get(player.id);
      let label = this.labels.get(player.id);

      if (sprite && !sprite.active) {
        this.sprites.delete(player.id);
        label?.destroy();
        this.labels.delete(player.id);
        sprite = undefined;
        label = undefined;
      }

      if (!sprite) {
        sprite = new PlayerSprite(this, player.x, player.y, 0xc9b8a8);
        this.sprites.set(player.id, sprite);
        label = this.add
          .text(player.x, player.y - 12, player.name, {
            fontSize: "8px",
            color: "#8a7f96",
            fontFamily: "monospace",
          })
          .setOrigin(0.5, 1)
          .setDepth(21);
        this.labels.set(player.id, label);
      }

      sprite.setPosition(player.x, player.y);
      if (sprite.active) sprite.updateAnimation(player.facing, false);
      label?.setPosition(sprite.x, sprite.y - 8);
      label?.setText(player.name);
    }

    for (const [id, sprite] of this.sprites) {
      if (id === this.localId) continue;
      if (!seen.has(id)) {
        if (sprite.active) sprite.destroy();
        this.labels.get(id)?.destroy();
        this.sprites.delete(id);
        this.labels.delete(id);
      }
    }
  }
}
