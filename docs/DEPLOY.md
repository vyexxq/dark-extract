# Deploy Dark Extract online (play with friends)

> **No credit card:** use **[FREE_NO_CREDIT_CARD.md](./FREE_NO_CREDIT_CARD.md)** (Vercel + Railway).  
> Render often shows a payment screen for **paid** instances — you can skip Render entirely.

You need **two** hosts:

| Part | What it is | Where to host (free, no card) |
|------|------------|-------------------------------|
| **Client** | The game in the browser (HTML/JS) | [Vercel](https://vercel.com) |
| **Server** | WebSocket multiplayer + saves | **[Railway](https://railway.com)** (recommended) or Render **Free** instance only |

GitHub Pages alone is **not enough** — it only serves static files. The game server must run somewhere that supports **WebSockets**.

---

## Recommended workflow (edit locally → friends play online)

1. **Put the project on GitHub** (private or public repo).
2. **Deploy the server** once on Render (steps below).
3. **Deploy the client** on Vercel, pointing at your server URL.
4. You keep editing in **Cursor** on your PC, then:
   ```bash
   git add .
   git commit -m "your change"
   git push
   ```
5. Vercel/Render **auto-rebuild** from GitHub — your friend refreshes the game URL.

You do **not** upload files by hand each time.

---

## Step 1 — GitHub repo

```bash
cd C:\Users\pc\Documents\dark-extract
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/dark-extract.git
git push -u origin main
```

---

## Step 2 — Deploy server (Render)

1. Go to [render.com](https://render.com) → **New +** → **Web Service**.
2. Connect your GitHub repo `dark-extract`.
3. Settings:
   - **Root Directory:** leave empty (repo root)
   - **Build Command:**  
     `npm install && npm run build -w @dark-extract/shared && npm run build -w @dark-extract/server`
   - **Start Command:**  
     `npm run start -w @dark-extract/server`
   - **Instance type:** Free (spins down after idle; first connect may take ~30s)
4. Add environment variable:
   - `PORT` = `10000` (Render sets this automatically on many plans; use what Render shows)
5. Deploy. Copy your service URL, e.g.  
   `https://dark-extract-server.onrender.com`

WebSocket URL for the client:

```text
wss://dark-extract-server.onrender.com
```

(use `wss://` not `ws://` on HTTPS sites)

---

## Step 3 — Deploy client (Vercel)

1. Go to [vercel.com](https://vercel.com) → **Add New Project** → import `dark-extract`.
2. Settings:
   - **Framework Preset:** Vite
   - **Root Directory:** `apps/client`
   - **Build Command:** `cd ../.. && npm install && npm run build -w @dark-extract/shared && npm run build -w @dark-extract/client`
   - **Output Directory:** `apps/client/dist`
3. **Environment variables:**
   - `VITE_WS_URL` = `wss://YOUR-SERVER.onrender.com` (from step 2)
4. Deploy. You get a URL like `https://dark-extract.vercel.app`.

Share that URL with your friend. Both of you open the same link to play together in the hub.

---

## Step 4 — Local development (unchanged)

```bash
npm run dev
```

- Client: http://localhost:5173  
- Server: ws://localhost:2567  

---

## Optional — GitHub Pages (client only)

If you prefer GitHub Pages instead of Vercel:

1. In `apps/client/vite.config.ts`, set `base: '/dark-extract/'` (your repo name).
2. Use GitHub Actions or deploy `apps/client/dist` to Pages.
3. Still set `VITE_WS_URL` at **build time** to your Render `wss://` URL.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Friend sees hub but no multiplayer | Server URL wrong; use `wss://` on HTTPS |
| “Offline” in game | Server sleeping (Render free) — wait and retry |
| Changes not live | Push to GitHub; wait for Vercel/Render build to finish |
| WebSocket blocked | Ensure server URL has no trailing slash |

---

## Summary

- **You edit** in Cursor → **git push** → auto deploy.
- **Friends play** at your Vercel (or Pages) link.
- **Server** stays on Render/Railway so multiplayer works.
