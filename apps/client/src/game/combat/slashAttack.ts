import Phaser from "phaser";
import type { Facing } from "@dark-extract/shared";

export type SlashHitTarget = {
  x: number;
  y: number;
  onHit: () => void;
};

export const SLASH_INNER = 8;
export const SLASH_OUTER = 32;
export const SLASH_ARC = 0.58;

const SWEEP_DURATION_MS = 95;
const SWEEP_SPAN = 1.0;
const HAND_OFFSET = 7;

export function aimAngleFromPointer(
  originX: number,
  originY: number,
  targetX: number,
  targetY: number,
): number {
  return Math.atan2(targetY - originY, targetX - originX);
}

export function facingFromAngle(angle: number): Facing {
  const deg = Phaser.Math.RadToDeg(angle);
  if (deg >= -45 && deg < 45) return "right";
  if (deg >= 45 && deg < 135) return "down";
  if (deg >= -135 && deg < -45) return "up";
  return "left";
}

export function isInSlashArc(
  originX: number,
  originY: number,
  angle: number,
  targetX: number,
  targetY: number,
): boolean {
  const dist = Phaser.Math.Distance.Between(originX, originY, targetX, targetY);
  if (dist < SLASH_INNER || dist > SLASH_OUTER) return false;

  const toTarget = Math.atan2(targetY - originY, targetX - originX);
  const diff = Phaser.Math.Angle.Wrap(toTarget - angle);
  return Math.abs(diff) <= SLASH_ARC;
}

/** Thin pixel sword extended in front of the player */
function buildSwordContainer(scene: Phaser.Scene, riposte: boolean): Phaser.GameObjects.Container {
  const blade = riposte ? 0xe8e080 : 0xb8c8e8;
  const edge = riposte ? 0xffffcc : 0xf0f8ff;
  const hiltC = 0x5a4030;
  const guardC = 0x7a7088;

  const sword = scene.add.container(0, 0);

  const pommel = scene.add.rectangle(-4, 0, 2, 2, 0x3a2820).setOrigin(1, 0.5);
  const hilt = scene.add.rectangle(-3, 0, 4, 3, hiltC).setOrigin(1, 0.5);
  const guard = scene.add.rectangle(0, 0, 1, 5, guardC).setOrigin(0.5, 0.5);
  const bladeBase = scene.add.rectangle(1, 0, 6, 2, blade).setOrigin(0, 0.5);
  const bladeMid = scene.add.rectangle(7, 0, 5, 1, edge).setOrigin(0, 0.5);
  const tip = scene.add.rectangle(12, 0, 2, 1, 0xffffff).setOrigin(0, 0.5);

  sword.add([pommel, hilt, guard, bladeBase, bladeMid, tip]);
  return sword;
}

export function performSlash(
  scene: Phaser.Scene,
  originX: number,
  originY: number,
  aimAngle: number,
  targets: SlashHitTarget[],
  riposte: boolean,
): void {
  const sword = buildSwordContainer(scene, riposte);
  sword.setDepth(27);

  const pivotX = originX + Math.cos(aimAngle) * HAND_OFFSET;
  const pivotY = originY + Math.sin(aimAngle) * HAND_OFFSET;

  const startAngle = Phaser.Math.RadToDeg(aimAngle - SWEEP_SPAN * 0.45);
  const endAngle = Phaser.Math.RadToDeg(aimAngle + SWEEP_SPAN * 0.45);

  sword.setPosition(pivotX, pivotY);
  sword.setAngle(startAngle);

  scene.tweens.add({
    targets: sword,
    angle: endAngle,
    duration: SWEEP_DURATION_MS,
    ease: "Cubic.easeOut",
    onComplete: () => sword.destroy(),
  });

  scene.time.delayedCall(Math.floor(SWEEP_DURATION_MS * 0.5), () => {
    const hitAngle = aimAngle + SWEEP_SPAN * 0.05;
    for (const t of targets) {
      if (isInSlashArc(originX, originY, hitAngle, t.x, t.y)) {
        t.onHit();
      }
    }
  });
}
