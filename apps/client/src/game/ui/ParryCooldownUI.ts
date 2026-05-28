import Phaser from "phaser";

/** Always-visible parry cooldown widget (top-left of game view) */
export class ParryCooldownUI extends Phaser.GameObjects.Container {
  private readonly ring: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private readonly status: Phaser.GameObjects.Text;
  private readonly panel: Phaser.GameObjects.Rectangle;
  private readonly readyLine: Phaser.GameObjects.Text;
  private readonly size = 32;
  private flashTween?: Phaser.Tweens.Tween;
  private wasReady = true;

  constructor(phaserScene: Phaser.Scene) {
    super(phaserScene, 52, 36);
    phaserScene.add.existing(this);
    this.setScrollFactor(0);
    this.setDepth(500);

    this.panel = phaserScene.add
      .rectangle(0, 4, 88, 52, 0x0a080c, 0.88)
      .setStrokeStyle(1, 0x3a3248);

    const iconX = -22;
    const bg = phaserScene.add.circle(iconX, 4, this.size / 2 + 2, 0x121018, 0.95);
    const border = phaserScene.add
      .circle(iconX, 4, this.size / 2, 0x1a1520, 1)
      .setStrokeStyle(2, 0x5a4a70);

    this.ring = phaserScene.add.graphics();
    this.label = phaserScene.add
      .text(iconX, 5, "F", {
        fontSize: "15px",
        color: "#e8e0ff",
        fontFamily: "monospace",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.status = phaserScene.add
      .text(14, -2, "PARRY", {
        fontSize: "10px",
        color: "#9b6bff",
        fontFamily: "monospace",
        fontStyle: "bold",
      })
      .setOrigin(0, 0.5);

    const hint = phaserScene.add
      .text(14, 10, "0.3s block on hit", {
        fontSize: "7px",
        color: "#6a6080",
        fontFamily: "monospace",
      })
      .setOrigin(0, 0.5);

    this.readyLine = phaserScene.add
      .text(14, 20, "READY", {
        fontSize: "9px",
        color: "#5a8a6a",
        fontFamily: "monospace",
      })
      .setOrigin(0, 0.5);

    this.add([this.panel, bg, border, this.ring, this.label, this.status, hint, this.readyLine]);
    this.drawReadyRing(iconX, 4);
  }

  updateCooldown(remainingMs: number, totalMs: number): void {
    const ready = remainingMs <= 0;

    if (ready && !this.wasReady) {
      this.flashReady();
    }
    this.wasReady = ready;

    const iconX = -22;
    const iconY = 4;

    if (ready) {
      this.drawReadyRing(iconX, iconY);
      this.label.setColor("#e8e0ff");
      this.status.setText("PARRY");
      this.status.setColor("#9b6bff");
      this.readyLine.setText("READY");
      this.readyLine.setColor("#5a8a6a");
      this.panel.setStrokeStyle(1, 0x5a8a6a);
      return;
    }

    const pct = Phaser.Math.Clamp(remainingMs / totalMs, 0, 1);
    const r = this.size / 2 - 2;
    const start = Phaser.Math.DegToRad(-90);
    const end = start + Math.PI * 2 * pct;

    this.ring.clear();
    this.ring.fillStyle(0x2a2238, 0.95);
    this.ring.beginPath();
    this.ring.arc(iconX, iconY, r, 0, Math.PI * 2, false);
    this.ring.closePath();
    this.ring.fillPath();

    this.ring.fillStyle(0xffdd44, 0.85);
    this.ring.beginPath();
    this.ring.moveTo(iconX, iconY);
    this.ring.arc(iconX, iconY, r, start, end, false);
    this.ring.closePath();
    this.ring.fillPath();

    this.label.setColor("#5a5068");
    this.status.setText("PARRY");
    this.status.setColor("#8a7f96");
    this.readyLine.setText(`${(remainingMs / 1000).toFixed(1)}s`);
    this.readyLine.setColor("#e8a84a");
    this.panel.setStrokeStyle(1, 0x4a3a48);
  }

  flashUsed(): void {
    this.flashTween?.stop();
    this.label.setColor("#ffffff");
    this.readyLine.setText("USED!");
    this.readyLine.setColor("#ffee88");

    this.flashTween = this.scene.tweens.add({
      targets: this.panel,
      alpha: 0.5,
      duration: 50,
      yoyo: true,
      repeat: 1,
      onComplete: () => this.panel.setAlpha(1),
    });
  }

  flashReady(): void {
    this.scene.tweens.add({
      targets: this.label,
      scaleX: 1.15,
      scaleY: 1.15,
      duration: 100,
      yoyo: true,
    });
  }

  private drawReadyRing(cx: number, cy: number): void {
    const r = this.size / 2 - 2;
    this.ring.clear();
    this.ring.lineStyle(2, 0x9b6bff, 1);
    this.ring.strokeCircle(cx, cy, r);
    this.ring.lineStyle(1, 0xc4b5fd, 0.5);
    this.ring.strokeCircle(cx, cy, r - 4);
  }
}
