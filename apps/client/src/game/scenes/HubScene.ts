import Phaser from "phaser";
import {
  HUB_HEIGHT_TILES,
  HUB_WIDTH_TILES,
  PLAYER_SPEED,
  TILE_SIZE,
  type Facing,
  type PlayerId,
  type PlayerInventory,
  type PlayerState,
} from "@dark-extract/shared";
import { getOrCreateHubConnection, type HubConnection } from "../../network/HubConnection";
import { PlayerSprite } from "../entities/PlayerSprite";
import { CONTRACTS_RADIUS, CONTRACTS_TILE, getHubTileIndex } from "../hub/hubLayout";
import { createMovementKeys, readMovement, type MovementKeys } from "../input/createMovementKeys";
import { renderTileGrid } from "../map/renderTilemap";

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
    if (data?.statusMsg) {
      this.registry.set("hubStatusMsg", data.statusMsg);
    }
  }

  create(): void {
    this.resetHubState();

    const wsUrl = (this.registry.get("wsUrl") as string) ?? "ws://localhost:2567";
    const playerName = (this.registry.get("playerName") as string) ?? "Hunter";

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

    this.connection = getOrCreateHubConnection(this.game, wsUrl, playerName);
    this.registry.set("connection", this.connection);

    this.connection.setHandlers({
      onWelcome: (id) => {
        if (!this.scene.isActive()) return;
        this.registry.set("networkPlayerId", id);
        this.networkId = id;
        if (this.localId !== id) {
          this.migrateLocalId(id);
        }
        this.removeDuplicateSelfSprites(id);
        this.setStatus("Connected");
      },
      onSnapshot: (snapshot) => {
        if (!this.scene.isActive()) return;
        this.syncPlayers(snapshot.players);
      },
      onInventory: (inv) => {
        this.inventory = inv;
        this.registry.set("hubInventory", inv);
        if (this.scene.isActive()) this.updateHud();
      },
      onDungeonStart: (seed, width, height) => {
        if (!this.scene.isActive()) return;
        this.ready = false;
        this.clearAllPlayers();
        this.connection.clearHandlers();
        this.scene.start("DungeonScene", {
          seed,
          width,
          height,
          inventory: this.inventory,
        });
      },
      onDungeonEnd: (msg) => {
        this.registry.set("hubStatusMsg", msg);
      },
      onExtractOk: (inv, msg) => {
        this.inventory = inv;
        this.registry.set("hubInventory", inv);
        this.registry.set("hubStatusMsg", msg);
      },
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
  }

  update(_time: number, delta: number): void {
    if (!this.ready || !this.movementKeys) return;

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

    const contractX = CONTRACTS_TILE.tx * TILE_SIZE + TILE_SIZE / 2;
    const contractY = CONTRACTS_TILE.ty * TILE_SIZE + TILE_SIZE / 2;
    const dist = Phaser.Math.Distance.Between(this.localPos.x, this.localPos.y, contractX, contractY);
    this.canEnterDungeon = dist < CONTRACTS_RADIUS;

    if (this.canEnterDungeon) {
      this.promptText?.setText("[E] Enter Goblin Cave (solo)");
      if (this.interactKey && Phaser.Input.Keyboard.JustDown(this.interactKey)) {
        this.connection.enterDungeon();
      }
    } else {
      this.promptText?.setText("");
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
    this.hudText.setText(`Loot: ${mats} · gold ${this.inventory.gold}`);
  }

  private drawLandmarks(): void {
    const cx = CONTRACTS_TILE.tx * TILE_SIZE + TILE_SIZE / 2;
    const cy = CONTRACTS_TILE.ty * TILE_SIZE + TILE_SIZE / 2;
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
