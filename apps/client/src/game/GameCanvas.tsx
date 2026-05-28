import { useEffect, useRef } from "react";
import Phaser from "phaser";
import type { PlayerProfile } from "@dark-extract/shared";
import { BootScene } from "./scenes/BootScene";
import { HubScene } from "./scenes/HubScene";
import { DungeonScene } from "./scenes/DungeonScene";

type Props = {
  wsUrl: string;
  authToken: string | null;
  playerName: string;
  profile: PlayerProfile | null;
};

export function GameCanvas({ wsUrl, authToken, playerName, profile }: Props) {
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
          g.registry.set("authToken", authToken);
          g.registry.set("playerName", playerName);
          g.registry.set("playerProfile", profile);
          if (profile) {
            g.registry.set("hubInventory", profile.inventory);
            g.registry.set("playerProgression", profile.progression);
          }
        },
      },
    });

    gameRef.current = game;

    return () => {
      const conn = game.registry.get("hubConnection");
      if (conn && typeof conn === "object" && "disconnect" in conn) {
        (conn as { disconnect: () => void }).disconnect();
      }
      game.destroy(true);
      gameRef.current = null;
    };
  }, [wsUrl, authToken, playerName, profile]);

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
