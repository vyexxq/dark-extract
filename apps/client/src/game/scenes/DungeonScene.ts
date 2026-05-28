import Phaser from "phaser";
import {
  DungeonTile,
  PLAYER_SPEED,
  TILE_SIZE,
  addMaterial,
  EMPTY_INVENTORY,
  generateDungeon,
  isWalkableTile,
  mergeInventory,
  tileAt,
  type DungeonMap,
  type Facing,
  type MaterialId,
  type PlayerInventory,
} from "@dark-extract/shared";
import { TILE } from "../art/TextureFactory";
import { aimAngleFromPointer, performSlash, type SlashHitTarget } from "../combat/slashAttack";
import {
  beginParryWindowOutline,
  createParryTelegraph,
  destroyParryTelegraph,
  spawnParrySuccessFx,
  type ParryOutlineHandle,
} from "../combat/parryFx";
import { PlayerSprite } from "../entities/PlayerSprite";
import { createMovementKeys, readMovement, type MovementKeys } from "../input/createMovementKeys";
import { renderTileGrid } from "../map/renderTilemap";
import { HealthBar } from "../ui/HealthBar";
import { ParryCooldownUI } from "../ui/ParryCooldownUI";
import type { HubConnection } from "../../network/HubConnection";

type EnemyKind = "goblin" | "shambler";
type EnemyAttackPhase = "idle" | "telegraph" | "strike" | "stunned";

interface EnemyDef {
  texture: string;
  anim: string;
  hp: number;
  speed: number;
  damage: number;
  telegraphSec: number;
  chaseRange: number;
  scale: number;
}

const ENEMY_DEFS: Record<EnemyKind, EnemyDef> = {
  goblin: {
    texture: "goblin",
    anim: "goblin-walk",
    hp: 40,
    speed: 55,
    damage: 12,
    telegraphSec: 0.28,
    chaseRange: 90,
    scale: 1,
  },
  shambler: {
    texture: "shambler",
    anim: "shambler-walk",
    hp: 68,
    speed: 34,
    damage: 18,
    telegraphSec: 0.36,
    chaseRange: 75,
    scale: 1.12,
  },
};

interface Enemy {
  kind: EnemyKind;
  def: EnemyDef;
  sprite: Phaser.GameObjects.Sprite;
  hp: number;
  maxHp: number;
  dead: boolean;
  phase: EnemyAttackPhase;
  phaseTimer: number;
  stunnedTimer: number;
  telegraph?: Phaser.GameObjects.Container;
  wasParried: boolean;
  strikeHit: boolean;
  healthBar: HealthBar;
}

const MELEE_RANGE = 18;
const STRIKE_SEC = 0.08;
const STUN_SEC = 1.25;
const ATTACK_COOLDOWN_SEC = 0.85;
const PARRY_COOLDOWN_MS = 1500;
const PARRY_WINDOW_MS = 300;

export class DungeonScene extends Phaser.Scene {
  private map!: DungeonMap;
  private player!: PlayerSprite;
  private pos = { x: 0, y: 0 };
  private facing: Facing = "down";
  private hp = 100;
  private maxHp = 100;
  private runLoot: PlayerInventory = { materials: [], gold: 0 };
  private enemies: Enemy[] = [];
  private movementKeys: MovementKeys | null = null;
  private parryKey: Phaser.Input.Keyboard.Key | null = null;
  private attackCooldown = 0;
  private counterReady = false;
  private counterTimer = 0;
  private parryCooldownMs = 0;
  private parryWindowMs = 0;
  private parryOutline?: ParryOutlineHandle;
  private parryUi!: ParryCooldownUI;
  private playerHpBar!: HealthBar;
  private hud!: Phaser.GameObjects.Text;
  private banner!: Phaser.GameObjects.Text;
  private extractGlow!: Phaser.GameObjects.Arc;
  private ended = false;
  private pointerAttackHandler?: (p: Phaser.Input.Pointer) => void;

  constructor() {
    super({ key: "DungeonScene" });
  }

  init(data: { seed: number; width: number; height: number; inventory?: PlayerInventory }): void {
    this.registry.set("inDungeon", true);
    this.map = generateDungeon(data.seed ?? Date.now(), data.width, data.height);
    if (data.inventory) {
      this.registry.set("hubInventory", data.inventory);
    }
    this.ended = false;
    this.enemies = [];
    this.hp = 100;
    this.runLoot = { materials: [], gold: 0 };
    this.counterReady = false;
    this.attackCooldown = 0;
    this.parryCooldownMs = 0;
    this.parryWindowMs = 0;
  }

  create(): void {
    const worldW = this.map.width * TILE_SIZE;
    const worldH = this.map.height * TILE_SIZE;

    this.cameras.main.setBounds(0, 0, worldW, worldH);
    this.cameras.main.setZoom(2);

    renderTileGrid(this, "tiles", this.map.width, this.map.height, (tx, ty) => {
      const tile = tileAt(this.map, tx, ty);
      switch (tile) {
        case DungeonTile.Wall:
          return TILE.DUNGEON_WALL;
        case DungeonTile.Corridor:
          return TILE.DUNGEON_CORRIDOR;
        case DungeonTile.Extract:
          return TILE.EXTRACT;
        case DungeonTile.Spawn:
          return TILE.SPAWN;
        default:
          return TILE.DUNGEON_FLOOR;
      }
    }, 0);

    this.pos.x = this.map.spawn.x * TILE_SIZE + TILE_SIZE / 2;
    this.pos.y = this.map.spawn.y * TILE_SIZE + TILE_SIZE / 2;
    this.player = new PlayerSprite(this, this.pos.x, this.pos.y, 0x9b6bff);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    this.extractGlow = this.add
      .circle(
        this.map.extract.x * TILE_SIZE + TILE_SIZE / 2,
        this.map.extract.y * TILE_SIZE + TILE_SIZE / 2,
        20,
        0x5a8a6a,
        0.2,
      )
      .setDepth(3);
    this.tweens.add({
      targets: this.extractGlow,
      alpha: { from: 0.15, to: 0.35 },
      scale: { from: 0.9, to: 1.1 },
      duration: 900,
      yoyo: true,
      repeat: -1,
    });

    this.map.enemySpawns.forEach((spawn, i) => {
      const kind: EnemyKind = i % 2 === 0 ? "goblin" : "shambler";
      this.spawnEnemy(kind, spawn.x, spawn.y);
    });

    if (this.input.keyboard) {
      this.movementKeys = createMovementKeys(this.input.keyboard);
      this.parryKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F);
    }

    this.playerHpBar = new HealthBar(this, 300, 456, 120, 200, 0);
    this.playerHpBar.setHealth(this.hp, this.maxHp);
    this.parryUi = new ParryCooldownUI(this);

    this.hud = this.add
      .text(8, 8, "", { fontSize: "9px", color: "#8a7f96", fontFamily: "monospace" })
      .setScrollFactor(0)
      .setDepth(100);

    this.banner = this.add
      .text(320, 24, "Goblin Cave", { fontSize: "11px", color: "#e8a84a", fontFamily: "monospace" })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(100);

    this.add
      .text(320, 440, "LMB slash · F = 0.3s parry window (block on hit) · time the enemy +", {
        fontSize: "9px",
        color: "#8a7f96",
        fontFamily: "monospace",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(100);

    this.pointerAttackHandler = (pointer) => this.tryMouseAttack(pointer);
    this.input.on("pointerdown", this.pointerAttackHandler);

    this.game.canvas.focus();
    this.updateHud();
  }

  private spawnEnemy(kind: EnemyKind, tx: number, ty: number): void {
    const def = ENEMY_DEFS[kind];
    const x = tx * TILE_SIZE + TILE_SIZE / 2;
    const y = ty * TILE_SIZE + TILE_SIZE / 2;
    const sprite = this.add.sprite(x, y, def.texture, 0).setDepth(15).setScale(def.scale);
    if (this.anims.exists(def.anim)) sprite.play(def.anim);

    const healthBar = new HealthBar(this, x, y - 16, 24, 22, 1);
    healthBar.setHealth(def.hp, def.hp);

    this.enemies.push({
      kind,
      def,
      sprite,
      hp: def.hp,
      maxHp: def.hp,
      dead: false,
      phase: "idle",
      phaseTimer: 0,
      stunnedTimer: 0,
      wasParried: false,
      strikeHit: false,
      healthBar,
    });
  }

  update(_time: number, delta: number): void {
    if (this.ended || !this.movementKeys) return;

    const dt = delta / 1000;
    this.attackCooldown = Math.max(0, this.attackCooldown - delta);
    this.parryCooldownMs = Math.max(0, this.parryCooldownMs - delta);
    this.parryWindowMs = Math.max(0, this.parryWindowMs - delta);
    this.parryUi.updateCooldown(this.parryCooldownMs, PARRY_COOLDOWN_MS);
    if (this.counterTimer > 0) {
      this.counterTimer -= dt;
      if (this.counterTimer <= 0) this.counterReady = false;
    }

    const { dx, dy } = readMovement(this.movementKeys);
    const moving = dx !== 0 || dy !== 0;
    if (moving) {
      const len = Math.hypot(dx, dy) || 1;
      const speed = PLAYER_SPEED * dt;
      const nx = this.pos.x + (dx / len) * speed;
      const ny = this.pos.y + (dy / len) * speed;
      if (this.canWalk(nx, this.pos.y)) this.pos.x = nx;
      if (this.canWalk(this.pos.x, ny)) this.pos.y = ny;
      if (Math.abs(dx) > Math.abs(dy)) this.facing = dx < 0 ? "left" : "right";
      else this.facing = dy < 0 ? "up" : "down";
    }

    this.player.setPosition(this.pos.x, this.pos.y);
    this.player.updateAnimation(this.facing, moving);
    this.playerHpBar.setHealth(this.hp, this.maxHp);

    this.updateEnemies(dt);
    this.checkExtract();

    if (this.hp <= 0) {
      this.endDungeon(false, "You fell. Run loot lost (gear kept).");
    }
  }

  shutdown(): void {
    if (this.pointerAttackHandler) {
      this.input.off("pointerdown", this.pointerAttackHandler);
    }
    this.parryOutline?.stop();
    for (const enemy of this.enemies) {
      destroyParryTelegraph(enemy.telegraph);
      enemy.healthBar.destroy();
    }
    this.enemies = [];
  }

  private tryMouseAttack(pointer: Phaser.Input.Pointer): void {
    if (!pointer.leftButtonDown() || this.ended || this.attackCooldown > 0) return;

    const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    this.doSlash(world.x, world.y);
  }

  private doSlash(targetX: number, targetY: number): void {
    this.attackCooldown = 280;
    const angle = aimAngleFromPointer(this.pos.x, this.pos.y, targetX, targetY);
    this.facing = this.player.faceToward(angle);
    this.player.playAttackLunge(angle);

    const riposte = this.counterReady;
    const damage = riposte ? 30 : 15;

    const targets: SlashHitTarget[] = this.enemies
      .filter((e) => !e.dead)
      .map((enemy) => ({
        x: enemy.sprite.x,
        y: enemy.sprite.y,
        onHit: () => this.damageEnemy(enemy, damage, riposte),
      }));

    performSlash(this, this.pos.x, this.pos.y, angle, targets, riposte);

    if (riposte) {
      this.counterReady = false;
      this.cameras.main.shake(50, 0.003);
    }
  }

  private damageEnemy(enemy: Enemy, amount: number, riposte: boolean): void {
    if (enemy.dead) return;
    enemy.hp -= amount;
    enemy.healthBar.setHealth(enemy.hp, enemy.maxHp);
    enemy.sprite.setTint(riposte ? 0xffee88 : 0xff8888);
    this.tweens.add({
      targets: enemy.sprite,
      x: enemy.sprite.x + Phaser.Math.Between(-2, 2),
      duration: 40,
      yoyo: true,
    });
    this.time.delayedCall(90, () => {
      if (enemy.sprite.active && !enemy.dead) enemy.sprite.clearTint();
    });
    if (enemy.hp <= 0) this.killEnemy(enemy);
    this.updateHud();
  }

  private killEnemy(enemy: Enemy): void {
    enemy.dead = true;
    destroyParryTelegraph(enemy.telegraph);
    enemy.telegraph = undefined;
    enemy.sprite.setAlpha(0.35);
    enemy.sprite.anims.stop();
    enemy.healthBar.setVisible(false);

    const mat: MaterialId =
      enemy.kind === "shambler"
        ? "iron_shard"
        : Math.random() > 0.5
          ? "goblin_tooth"
          : "cave_moss";
    this.runLoot = addMaterial(this.runLoot, mat, 1);
    if (Math.random() > 0.65) {
      this.runLoot = { ...this.runLoot, gold: this.runLoot.gold + 1 };
    }
    this.updateHud();
  }

  private startParryCooldown(): void {
    this.parryCooldownMs = PARRY_COOLDOWN_MS;
    this.parryUi.flashUsed();
  }

  private activateParryWindow(): void {
    if (this.parryCooldownMs > 0 || this.parryWindowMs > 0) return;

    this.parryWindowMs = PARRY_WINDOW_MS;
    this.startParryCooldown();

    this.parryOutline?.stop();
    this.parryOutline = beginParryWindowOutline(
      this,
      () => ({ x: this.pos.x, y: this.pos.y }),
      PARRY_WINDOW_MS,
    );

    this.time.delayedCall(PARRY_WINDOW_MS, () => {
      this.parryOutline?.stop();
      this.parryOutline = undefined;
    });
  }

  /** Called when enemy strike connects during active parry window */
  private onParrySuccess(enemy: Enemy): void {
    this.parryWindowMs = 0;
    this.parryOutline?.stop();
    this.parryOutline = undefined;

    enemy.wasParried = true;
    enemy.phase = "stunned";
    enemy.stunnedTimer = STUN_SEC;
    enemy.strikeHit = true;
    destroyParryTelegraph(enemy.telegraph);
    enemy.telegraph = undefined;
    spawnParrySuccessFx(this, enemy.sprite.x, enemy.sprite.y);
    enemy.sprite.setTint(0xaaaaff);
    this.counterReady = true;
    this.counterTimer = 1.4;
    this.banner.setText("Parry! — click to riposte");
    this.banner.setColor("#ffdd44");
    this.time.delayedCall(1400, () => {
      if (!this.ended) {
        this.banner.setText("Goblin Cave");
        this.banner.setColor("#e8a84a");
      }
    });
  }

  private handleParryInput(): void {
    if (!this.parryKey || !Phaser.Input.Keyboard.JustDown(this.parryKey)) return;
    if (this.parryCooldownMs > 0) return;
    this.activateParryWindow();
  }

  private updateEnemies(dt: number): void {
    this.handleParryInput();

    for (const enemy of this.enemies) {
      if (enemy.dead) continue;

      enemy.healthBar.followWorld(enemy.sprite.x, enemy.sprite.y, -18);

      const dist = Phaser.Math.Distance.Between(
        this.pos.x,
        this.pos.y,
        enemy.sprite.x,
        enemy.sprite.y,
      );

      if (enemy.stunnedTimer > 0) {
        enemy.stunnedTimer -= dt;
        enemy.sprite.setTint(0x7788cc);
        if (enemy.stunnedTimer <= 0) {
          enemy.sprite.clearTint();
          enemy.phase = "idle";
          enemy.phaseTimer = 0;
        }
        continue;
      }

      if (enemy.phase === "idle") {
        enemy.sprite.clearTint();
        if (dist < enemy.def.chaseRange && dist > MELEE_RANGE) {
          const angle = Phaser.Math.Angle.Between(
            enemy.sprite.x,
            enemy.sprite.y,
            this.pos.x,
            this.pos.y,
          );
          const speed = enemy.def.speed * dt;
          const nx = enemy.sprite.x + Math.cos(angle) * speed;
          const ny = enemy.sprite.y + Math.sin(angle) * speed;
          if (this.canWalk(nx, enemy.sprite.y)) enemy.sprite.x = nx;
          if (this.canWalk(enemy.sprite.x, ny)) enemy.sprite.y = ny;
          if (this.anims.exists(enemy.def.anim)) enemy.sprite.play(enemy.def.anim, true);
        }
        if (dist < MELEE_RANGE && enemy.phaseTimer <= 0) {
          enemy.phase = "telegraph";
          enemy.phaseTimer = 0;
          enemy.wasParried = false;
          enemy.strikeHit = false;
          enemy.telegraph = createParryTelegraph(
            this,
            enemy.sprite.x,
            enemy.sprite.y - 6,
          );
        }
        if (enemy.phaseTimer > 0) enemy.phaseTimer -= dt;
      }

      if (enemy.phase === "telegraph") {
        enemy.phaseTimer += dt;
        enemy.telegraph?.setPosition(enemy.sprite.x, enemy.sprite.y - 6);
        enemy.sprite.setTint(0xff6666);

        if (
          enemy.phase === "telegraph" &&
          enemy.phaseTimer >= enemy.def.telegraphSec &&
          !enemy.wasParried
        ) {
          destroyParryTelegraph(enemy.telegraph);
          enemy.telegraph = undefined;
          enemy.phase = "strike";
          enemy.phaseTimer = 0;
        }
      }

      if (enemy.phase === "strike") {
        enemy.phaseTimer += dt;
        enemy.sprite.setTint(0xff2222);
        if (!enemy.strikeHit && enemy.phaseTimer >= STRIKE_SEC * 0.5) {
          if (dist < MELEE_RANGE + 4) {
            if (this.parryWindowMs > 0) {
              this.onParrySuccess(enemy);
            } else {
              enemy.strikeHit = true;
              this.hp -= enemy.def.damage;
              this.playerHpBar.setHealth(this.hp, this.maxHp);
              this.cameras.main.shake(90, 0.005);
              this.cameras.main.flash(60, 80, 20, 20, false, undefined, 0.12);
              this.updateHud();
            }
          } else {
            enemy.strikeHit = true;
          }
        }
        if (enemy.phaseTimer >= STRIKE_SEC) {
          enemy.phase = "idle";
          enemy.phaseTimer = ATTACK_COOLDOWN_SEC;
          enemy.sprite.clearTint();
        }
      }
    }
  }

  private canWalk(px: number, py: number): boolean {
    const tx = Math.floor(px / TILE_SIZE);
    const ty = Math.floor(py / TILE_SIZE);
    return isWalkableTile(tileAt(this.map, tx, ty));
  }

  private checkExtract(): void {
    const ex = this.map.extract.x * TILE_SIZE + TILE_SIZE / 2;
    const ey = this.map.extract.y * TILE_SIZE + TILE_SIZE / 2;
    if (Phaser.Math.Distance.Between(this.pos.x, this.pos.y, ex, ey) < 14) {
      this.endDungeon(true, "Extracted safely!");
    }
  }

  private endDungeon(success: boolean, message: string): void {
    if (this.ended) return;
    this.ended = true;
    this.movementKeys = null;

    for (const enemy of this.enemies) {
      destroyParryTelegraph(enemy.telegraph);
    }

    this.banner.setText(message);
    this.banner.setColor(success ? "#5a8a6a" : "#c95050");

    const connection = this.registry.get("connection") as HubConnection | undefined;
    const base =
      (this.registry.get("hubInventory") as PlayerInventory | undefined) ?? EMPTY_INVENTORY;

    if (success) {
      const merged = mergeInventory(base, this.runLoot);
      this.registry.set("hubInventory", merged);
      connection?.extractDungeon(this.runLoot);
    } else {
      connection?.abandonDungeon("death");
    }

    this.time.delayedCall(1000, () => {
      const inv =
        (this.registry.get("hubInventory") as PlayerInventory | undefined) ?? base;
      this.scene.stop();
      this.scene.start("HubScene", { inventory: inv, statusMsg: message });
    });
  }

  private updateHud(): void {
    const alive = this.enemies.filter((e) => !e.dead).length;
    const mats = this.runLoot.materials.map((m) => `${m.id}:${m.qty}`).join(" ") || "—";
    this.hud.setText(`Foes ${alive} · loot ${mats} · gold ${this.runLoot.gold}`);
  }
}
