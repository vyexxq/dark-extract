import { useState } from "react";
import type { PlayerProfile } from "@dark-extract/shared";
import { parseServerMessage } from "@dark-extract/shared";

type Props = {
  wsUrl: string;
  onAuthed: (token: string | null, profile: PlayerProfile | null, guestName: string) => void;
};

export function AuthScreen({ wsUrl, onAuthed }: Props) {
  const [mode, setMode] = useState<"login" | "register" | "guest">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [guestName, setGuestName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = () => {
    setError("");
    setBusy(true);

    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      if (mode === "guest") {
        const name = guestName.trim().slice(0, 16) || `Hunter-${Math.floor(Math.random() * 9000)}`;
        socket.send(JSON.stringify({ type: "join", name }));
        return;
      }
      socket.send(
        JSON.stringify({
          type: mode === "register" ? "register" : "login",
          username: username.trim(),
          password,
        }),
      );
    };

    socket.onmessage = (ev) => {
      const msg = parseServerMessage(String(ev.data));
      if (!msg) return;

      if (msg.type === "auth_ok") {
        localStorage.setItem("de_auth_token", msg.token);
        localStorage.setItem("de_username", msg.profile.username);
        socket.close();
        setBusy(false);
        onAuthed(msg.token, msg.profile, msg.profile.username);
        return;
      }

      if (msg.type === "welcome" && mode === "guest") {
        socket.close();
        setBusy(false);
        onAuthed(null, msg.profile ?? null, msg.name);
        return;
      }

      if (msg.type === "error") {
        setError(msg.message);
        socket.close();
        setBusy(false);
      }
    };

    socket.onerror = () => {
      setError("Could not reach server");
      setBusy(false);
    };
  };

  const resumeSession = () => {
    const token = localStorage.getItem("de_auth_token");
    if (!token) return;
    setBusy(true);
    const socket = new WebSocket(wsUrl);
    socket.onopen = () => {
      socket.send(JSON.stringify({ type: "auth_session", token }));
    };
    socket.onmessage = (ev) => {
      const msg = parseServerMessage(String(ev.data));
      if (msg?.type === "auth_ok") {
        socket.close();
        setBusy(false);
        onAuthed(msg.token, msg.profile, msg.profile.username);
      } else if (msg?.type === "error") {
        localStorage.removeItem("de_auth_token");
        setError(msg.message);
        socket.close();
        setBusy(false);
      }
    };
  };

  return (
    <div className="auth-screen">
      <h2>Dark Extract</h2>
      <p className="auth-sub">Phase 2 — accounts, parties, shared dungeons</p>

      <div className="auth-tabs">
        <button type="button" className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>
          Login
        </button>
        <button
          type="button"
          className={mode === "register" ? "active" : ""}
          onClick={() => setMode("register")}
        >
          Register
        </button>
        <button type="button" className={mode === "guest" ? "active" : ""} onClick={() => setMode("guest")}>
          Guest
        </button>
      </div>

      {mode !== "guest" ? (
        <>
          <input
            placeholder="Username (3–16)"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            maxLength={16}
          />
          <input
            type="password"
            placeholder="Password (6+)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </>
      ) : (
        <input
          placeholder="Display name (optional)"
          value={guestName}
          onChange={(e) => setGuestName(e.target.value)}
          maxLength={16}
        />
      )}

      {error && <p className="auth-error">{error}</p>}

      <button type="button" className="auth-submit" disabled={busy} onClick={submit}>
        {busy ? "Connecting…" : mode === "register" ? "Create account" : mode === "login" ? "Log in" : "Play as guest"}
      </button>

      {localStorage.getItem("de_auth_token") && mode === "login" && (
        <button type="button" className="auth-link" disabled={busy} onClick={resumeSession}>
          Resume last session
        </button>
      )}
    </div>
  );
}
