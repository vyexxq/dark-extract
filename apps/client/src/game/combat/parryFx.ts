import Phaser from "phaser";

export function createParryTelegraph(
  scene: Phaser.Scene,
  x: number,
  y: number,
): Phaser.GameObjects.Container {
  const container = scene.add.container(x, y).setDepth(30);

  const arm = 9;
  const thick = 2;
  const crossH = scene.add.rectangle(0, 0, arm * 2, thick, 0xffffff, 1);
  const crossV = scene.add.rectangle(0, 0, thick, arm * 2, 0xffffff, 1);
  const diag1 = scene.add.rectangle(0, 0, thick, arm * 1.3, 0xffffff, 0.9).setAngle(45);
  const diag2 = scene.add.rectangle(0, 0, thick, arm * 1.3, 0xffffff, 0.9).setAngle(-45);

  container.add([crossH, crossV, diag1, diag2]);

  scene.tweens.add({
    targets: container,
    angle: 360,
    duration: 360,
    repeat: -1,
    ease: "Linear",
  });

  scene.tweens.add({
    targets: [crossH, crossV, diag1, diag2],
    alpha: { from: 0.3, to: 1 },
    duration: 90,
    yoyo: true,
    repeat: -1,
  });

  return container;
}

export function destroyParryTelegraph(telegraph: Phaser.GameObjects.Container | undefined): void {
  if (!telegraph?.active) return;
  telegraph.destroy(true);
}

export function spawnParrySuccessFx(scene: Phaser.Scene, x: number, y: number): void {
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const len = 14 + Math.random() * 10;
    const spark = scene.add
      .rectangle(x, y, 2, 4, 0xffdd44, 1)
      .setAngle((angle * 180) / Math.PI)
      .setDepth(35);

    scene.tweens.add({
      targets: spark,
      x: x + Math.cos(angle) * len,
      y: y + Math.sin(angle) * len,
      alpha: 0,
      scaleX: 0.3,
      scaleY: 0.3,
      duration: 200 + Math.random() * 80,
      ease: "Cubic.easeOut",
      onComplete: () => spark.destroy(),
    });
  }

  const burst = scene.add.star(x, y, 4, 3, 6, 0xffee66, 0.9).setDepth(34);
  scene.tweens.add({
    targets: burst,
    alpha: 0,
    scale: 2,
    angle: 90,
    duration: 200,
    onComplete: () => burst.destroy(),
  });
}

export type ParryOutlineHandle = { stop: () => void };

/** Yellow outline while parry window is active (0.3s) */
export function beginParryWindowOutline(
  scene: Phaser.Scene,
  getPosition: () => { x: number; y: number },
  durationMs: number,
): ParryOutlineHandle {
  const g = scene.add.graphics().setDepth(24);
  const start = scene.time.now;

  const draw = (alpha: number) => {
    const { x, y } = getPosition();
    g.clear();
    g.lineStyle(2, 0xffdd44, alpha);
    g.strokeRoundedRect(x - 7, y - 9, 14, 17, 2);
    g.lineStyle(1, 0xffffff, alpha * 0.35);
    g.strokeRoundedRect(x - 8, y - 10, 16, 19, 3);
  };

  const onUpdate = (): void => {
    const elapsed = scene.time.now - start;
    if (elapsed >= durationMs || !g.active) {
      stop();
      return;
    }
    const pulse = 0.55 + 0.45 * Math.sin(elapsed * 0.04);
    const fade = 1 - elapsed / durationMs;
    draw(pulse * fade);
  };

  const stop = (): void => {
    scene.events.off(Phaser.Scenes.Events.UPDATE, onUpdate);
    if (g.active) g.destroy();
  };

  scene.events.on(Phaser.Scenes.Events.UPDATE, onUpdate);
  draw(1);

  return { stop };
}
