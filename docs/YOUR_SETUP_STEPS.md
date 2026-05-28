# What you need to do (one-time, ~15 minutes, $0)

I prepared the project for **GitHub + Render (server) + Vercel (game)**.  
I **cannot** click “Sign in with GitHub” on your accounts from here — you do these steps once, then every `git push` updates the live game.

**Cost:** $0 on free tiers (personal / hobby use).

---

## What I already set up in the project

| File | Purpose |
|------|---------|
| `apps/client/vercel.json` | Vercel build settings (no dashboard typing) |
| `render.yaml` | One-click Render server blueprint |
| `apps/client/.env.example` | Shows `VITE_WS_URL` for production |
| `apps/server/src/index.ts` | HTTP `/` health check + WebSocket on same port |
| `docs/DEPLOY.md` | Full reference / troubleshooting |

---

## Step 1 — GitHub (store the code)

1. Create a free account: https://github.com/signup  
2. Create a **new repository** (empty): name it `dark-extract`, **Private** is fine.  
3. On your PC, open PowerShell:

```powershell
cd C:\Users\pc\Documents\dark-extract
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/dark-extract.git
git push -u origin main
```

Replace `YOUR_GITHUB_USERNAME`. GitHub may ask you to sign in in the browser.

---

## Step 2 — Render (free WebSocket server)

Research (2026): Render free web services **spin down after 15 minutes with no traffic**, then take **~1 minute** to wake up. **750 free instance hours/month.** WebSockets are supported; active WS traffic counts as traffic.

1. Sign up: https://dashboard.render.com/ (use **Sign in with GitHub**).  
2. **Blueprints** → **New Blueprint Instance** → connect repo `dark-extract`.  
3. Render should detect `render.yaml` → **Apply**.  
4. Wait until status is **Live**.  
5. Copy your service URL, e.g. `https://dark-extract-server.onrender.com`  
6. Test in browser: open that URL — you should see JSON like `{"ok":true,"service":"dark-extract-hub"}`.

**Your WebSocket URL for Vercel** (swap in your real host):

```text
wss://dark-extract-server.onrender.com
```

Use `wss://` (not `ws://`). No trailing slash.

---

## Step 3 — Vercel (free game website)

Research (2026): Vercel **Hobby** is free for personal projects — auto deploy on git push, HTTPS, plenty of bandwidth for a small game.

1. Sign up: https://vercel.com/signup (use **Continue with GitHub**).  
2. **Add New… → Project** → import `dark-extract`.  
3. **Root Directory:** click Edit → set to `apps/client` (important).  
4. Vercel should read `vercel.json` automatically.  
5. **Environment Variables** → add:

| Name | Value |
|------|--------|
| `VITE_WS_URL` | `wss://YOUR-SERVER.onrender.com` |

6. **Deploy**.  
7. Copy your game URL, e.g. `https://dark-extract.vercel.app`.

Share **only the Vercel URL** with your friend.

---

## Step 4 — Play test

1. You open the Vercel link.  
2. Friend opens the **same** link.  
3. Both enter a name in the hub — you should see each other move.  
4. If the server was asleep, wait up to ~60s and refresh once.

---

## After setup — how updates work

```powershell
cd C:\Users\pc\Documents\dark-extract
# edit files in Cursor (or ask the AI to edit)
git add .
git commit -m "describe change"
git push
```

- **Client-only changes:** Vercel rebuilds (~1–2 min) → hard refresh game (`Ctrl+Shift+R`).  
- **Server changes:** Render rebuilds too → same refresh.  
- No manual file uploads.

---

## Optional — install GitHub CLI later

```powershell
winget install GitHub.cli
gh auth login
```

Not required; git + browser login is enough.

---

## If something fails

| Symptom | Fix |
|---------|-----|
| Hub works alone, friend invisible | Wrong `VITE_WS_URL` or missing `wss://` |
| Stuck loading / offline | Render waking up — wait 60s, refresh |
| Black screen after deploy | Hard refresh; check Vercel build logs |
| Build failed on Vercel | Root Directory must be `apps/client` |

More detail: [DEPLOY.md](./DEPLOY.md).

---

## What to send me back (so I can wire env vars in docs)

After you finish steps 2–3, you can paste (no secrets):

- Render URL: `https://....onrender.com`  
- Vercel URL: `https://....vercel.app`  

I can’t log into your dashboards, but I can help debug if URLs don’t connect.
