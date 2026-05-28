import { useEffect, useRef } from "react";
import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { HubScene } from "./scenes/HubScene";
import { DungeonScene } from "./scenes/DungeonScene";

type Props = {
  wsUrl: string;
  playerName: string;
};

export function GameCanvas({ wsUrl, playerName }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    const parent = containerRef.current;
    if (!parent || gameRef.current) return;

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent,
      width: 640,
      height: 480,
      backgroundColor: "#1a1520",
      pixelArt: true,
      antialias: false,
      roundPixels: true,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 640,
        height: 480,
      },
      physics: {
        default: "arcade",
        arcade: { debug: false },
      },
      scene: [BootScene, HubScene, DungeonScene],
      callbacks: {
        preBoot: (g) => {
          g.registry.set("wsUrl", wsUrl);
          g.registry.set("playerName", playerName);
        },
      },
    });

    gameRef.current = game;

    return () => {
      game.destroy(true);
      gameRef.current = null;
    };
  }, [wsUrl, playerName]);

  return (
    <div className="game-shell">
      <div
        ref={containerRef}
        className="game-canvas-host"
        style={{ width: 640, height: 480 }}
        onPointerDown={(e) => {
          const canvas = e.currentTarget.querySelector("canvas");
          canvas?.focus();
        }}
      />
    </div>
  );
}
