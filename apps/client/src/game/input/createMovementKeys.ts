import Phaser from "phaser";

export type MovementKeys = {
  cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  w: Phaser.Input.Keyboard.Key;
  a: Phaser.Input.Keyboard.Key;
  s: Phaser.Input.Keyboard.Key;
  d: Phaser.Input.Keyboard.Key;
};

export function createMovementKeys(
  keyboard: Phaser.Input.Keyboard.KeyboardPlugin,
): MovementKeys {
  const cursors = keyboard.createCursorKeys();
  return {
    cursors,
    w: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
    a: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
    s: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
    d: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
  };
}

export function readMovement(keys: MovementKeys): { dx: number; dy: number } {
  const dx =
    (keys.cursors.left?.isDown || keys.a.isDown ? -1 : 0) +
    (keys.cursors.right?.isDown || keys.d.isDown ? 1 : 0);
  const dy =
    (keys.cursors.up?.isDown || keys.w.isDown ? -1 : 0) +
    (keys.cursors.down?.isDown || keys.s.isDown ? 1 : 0);
  return { dx, dy };
}
