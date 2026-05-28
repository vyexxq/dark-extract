# What you need to do (one-time, $0)

| Part | Host |
|------|------|
| Game in browser | **Vercel** (free Hobby) |
| Multiplayer server | **Render** (Free instance — $0) |
| Code | **GitHub** |

> **Card on Render?** Fine — see **[RENDER_STAY_FREE.md](./RENDER_STAY_FREE.md)** so you are not charged.  
> **No card / no Render:** use **[FREE_NO_CREDIT_CARD.md](./FREE_NO_CREDIT_CARD.md)** (Railway).

---

## Step 1 — GitHub (~5 min)

1. https://github.com → new repo `dark-extract` (empty).
2. PowerShell:

```powershell
cd C:\Users\pc\Documents\dark-extract
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/dark-extract.git
git push -u origin main
```

---

## Step 2 — Render server (~5 min)

**Do not use Blueprint if it shows Starter $7.** Use manual Web Service:

1. https://dashboard.render.com → **New +** → **Web Service**.
2. Connect repo `dark-extract` (see [RENDER_STAY_FREE.md](./RENDER_STAY_FREE.md) for build/start commands).
3. **Instance type: Free** — must say $0, not Starter $7.
4. When **Live**, open `https://YOUR-SERVICE.onrender.com` → JSON `{"ok":true,...}`.

Your WebSocket URL:

```text
wss://YOUR-SERVICE.onrender.com
```

Read **[RENDER_STAY_FREE.md](./RENDER_STAY_FREE.md)** so your card is never charged for a paid tier.

### Alternative: Railway (no Render)

See **[FREE_NO_CREDIT_CARD.md](./FREE_NO_CREDIT_CARD.md)**.

---

## Step 3 — Vercel game (~5 min)

1. https://vercel.com → **Continue with GitHub**.
2. Import `dark-extract`.
3. **Root Directory:** `apps/client`
4. **Environment variable:**

| Name | Value |
|------|--------|
| `VITE_WS_URL` | `wss://YOUR-SERVICE.onrender.com` |

5. Deploy → share the `https://....vercel.app` link with your friend.

---

## Step 4 — Play

- Both open the **Vercel** URL.
- Same name hub → you should see each other.
- Hard refresh after updates: `Ctrl+Shift+R`.

---

## Updates (after setup)

```powershell
cd C:\Users\pc\Documents\dark-extract
git add .
git commit -m "what changed"
git push
```

Vercel + Railway rebuild from GitHub. No manual uploads.

---

## Render (optional — only if you avoid the payment screen)

Render **can** be free **without** a card if you create a **Web Service** manually and choose **Instance type: Free** (not Starter/Standard).

If the only option is “add payment method,” **close it** and use Railway instead.

---

## Quick test tonight (no Railway either)

See **[FREE_NO_CREDIT_CARD.md](./FREE_NO_CREDIT_CARD.md)** → Cloudflare quick tunnel while `npm run dev` runs on your PC.

---

## Files in this repo

| File | Purpose |
|------|---------|
| `railway.toml` | Railway start command |
| `apps/client/vercel.json` | Vercel build |
| `apps/client/.env.example` | `VITE_WS_URL` |
| `docs/FREE_NO_CREDIT_CARD.md` | No-card options + Render explanation |
