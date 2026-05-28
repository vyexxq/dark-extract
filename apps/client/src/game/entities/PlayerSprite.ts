import Phaser from "phaser";
import type { Facing } from "@dark-extract/shared";
import { facingFromAngle } from "../combat/slashAttack";

const FACING_TO_ROW: Record<Facing, string> = {
  down: "down",
  left: "left",
  right: "right",
  up: "up",
};

export class PlayerSprite extends Phaser.GameObjects.Sprite {
  constructor(scene: Phaser.Scene, x: number, y: number, tint?: number) {
    super(scene, x, y, "player", 0);
    scene.add.existing(this);
    this.setDepth(20);
    if (tint) this.setTint(tint);
    if (scene.anims.exists("player-idle-down")) {
      this.play("player-idle-down");
    }
  }

  /** Face slash / aim direction (mouse) */
  faceToward(angle: number): Facing {
    const facing = facingFromAngle(angle);
    if (!this.active || !this.scene) return facing;

    this.setFlipX(facing === "left");
    this.updateAnimation(facing, false);
    return facing;
  }

  /** Short lunge in attack direction */
  playAttackLunge(angle: number): void {
    if (!this.scene) return;
    const dx = Math.cos(angle) * 4;
    const dy = Math.sin(angle) * 4;
    this.scene.tweens.add({
      targets: this,
      x: this.x + dx,
      y: this.y + dy,
      duration: 50,
      yoyo: true,
      ease: "Quad.easeOut",
    });
  }

  updateAnimation(facing: Facing, moving: boolean): void {
    if (!this.active || !this.scene) return;

    const dir = FACING_TO_ROW[facing];
    const key = moving ? `player-walk-${dir}` : `player-idle-${dir}`;
    if (!this.scene.anims.exists(key)) return;
    if (this.anims.currentAnim?.key !== key) {
      this.play(key, true);
    }
  }
}
