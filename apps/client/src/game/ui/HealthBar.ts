import Phaser from "phaser";

export class HealthBar extends Phaser.GameObjects.Container {
  private readonly barWidth: number;
  private readonly fill: Phaser.GameObjects.Rectangle;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    width = 28,
    depth = 40,
    scrollFactor = 0,
  ) {
    super(scene, x, y);
    this.barWidth = width;

    scene.add.existing(this);
    this.setScrollFactor(scrollFactor);
    this.setDepth(depth);

    const bg = scene.add
      .rectangle(0, 0, width, 5, 0x0a080c, 0.85)
      .setStrokeStyle(1, 0x2a2233, 0.9);
    this.fill = scene.add.rectangle(-width / 2 + 1, 0, width - 2, 3, 0xc95050).setOrigin(0, 0.5);

    this.add([bg, this.fill]);
  }

  setHealth(current: number, max: number): void {
    const pct = Phaser.Math.Clamp(current / max, 0, 1);
    const w = Math.max(0, (this.barWidth - 2) * pct);
    this.fill.width = w;

    if (pct > 0.55) this.fill.setFillStyle(0x5a8a6a);
    else if (pct > 0.28) this.fill.setFillStyle(0xe8a84a);
    else this.fill.setFillStyle(0xc95050);
  }

  followWorld(x: number, y: number, offsetY = -14): void {
    this.setPosition(x, y + offsetY);
  }
}
