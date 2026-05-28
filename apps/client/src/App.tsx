import { useMemo } from "react";
import { GameCanvas } from "./game/GameCanvas";

const WS_URL =
  import.meta.env.VITE_WS_URL ?? "ws://localhost:2567";

export function App() {
  const playerName = useMemo(() => {
    const stored = sessionStorage.getItem("de_player_name");
    if (stored) return stored;
    const name = `Hunter-${Math.floor(Math.random() * 9000 + 1000)}`;
    sessionStorage.setItem("de_player_name", name);
    return name;
  }, []);

  return (
    <div className="app">
      <header className="hud">
        <h1>Dark Extract</h1>
        <p className="subtitle">Phase 1 — Hub & Goblin Cave</p>
        <p className="hint">
          LMB slash toward cursor · F parry (cooldown shown) · E = dungeon
        </p>
      </header>
      <GameCanvas wsUrl={WS_URL} playerName={playerName} />
      <footer className="status">
        <span>{playerName}</span>
        <span className="dot">·</span>
        <span>{WS_URL}</span>
      </footer>
    </div>
  );
}
