import { useState } from "react";
import type { PlayerProfile } from "@dark-extract/shared";
import { AuthScreen } from "./components/AuthScreen";
import { GameCanvas } from "./game/GameCanvas";

const WS_URL = import.meta.env.VITE_WS_URL ?? "ws://localhost:2567";

export function App() {
  const [session, setSession] = useState<{
    token: string | null;
    profile: PlayerProfile | null;
    name: string;
  } | null>(null);

  if (!session) {
    return (
      <div className="app">
        <AuthScreen
          wsUrl={WS_URL}
          onAuthed={(token, profile, name) => setSession({ token, profile, name })}
        />
      </div>
    );
  }

  return (
    <div className="app">
      <header className="hud">
        <h1>Dark Extract</h1>
        <p className="subtitle">Phase 2 — Party dungeons · XP · accounts</p>
        <p className="hint">
          Tab = lobby & invites · E = cave · R = ready · LMB/F in dungeon
        </p>
      </header>
      <GameCanvas
        wsUrl={WS_URL}
        authToken={session.token}
        playerName={session.name}
        profile={session.profile}
      />
      <footer className="status">
        <span>{session.profile?.username ?? session.name}</span>
        {session.profile && (
          <>
            <span className="dot">·</span>
            <span>Lv {session.profile.progression.level}</span>
          </>
        )}
        <span className="dot">·</span>
        <button
          type="button"
          className="logout-btn"
          onClick={() => {
            localStorage.removeItem("de_auth_token");
            setSession(null);
          }}
        >
          Log out
        </button>
      </footer>
    </div>
  );
}
