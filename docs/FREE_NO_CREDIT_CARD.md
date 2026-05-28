# Free hosting with NO credit card

Render often shows **“Payment Information Required”** when you pick a **paid** instance (or their UI nudges you toward paid). You do **not** need to enter a card for this game.

Use this order instead:

---

## Recommended: Vercel (game) + Railway (server)

| | Vercel | Railway |
|---|--------|---------|
| **What** | Browser game | WebSocket server |
| **Card?** | Usually **no** for Hobby | **No** for free trial ($5 credit, 30 days), then **$1/month** free plan |
| **URL** | Stable `*.vercel.app` | Stable `*.up.railway.app` |

### 1. GitHub (same as before)

Push `dark-extract` to GitHub.

### 2. Railway — server (skip Render entirely)

1. https://railway.com → **Login** (GitHub).
2. **New Project** → **Deploy from GitHub** → repo `dark-extract`.
3. If it asks for payment: look for **“Skip”**, **“Continue on Free”**, or stay on **Trial / Free** — do **not** upgrade to Hobby unless you want to pay $5/mo.
4. Open the service → **Settings** → **Networking** → **Generate Domain**.
5. Copy the HTTPS URL, e.g. `https://dark-extract-production.up.railway.app`
6. Test in browser — should show `{"ok":true,"service":"dark-extract-hub"}`.

**WebSocket URL for Vercel** (swap host):

```text
wss://dark-extract-production.up.railway.app
```

Railway free trial: ~$5 one-time credit, 30 days, **no card** on signup (per Railway docs). After that, **$1/month** free credits — enough for one tiny always-on server if usage stays low.

### 3. Vercel — game (unchanged)

1. https://vercel.com → GitHub import → repo `dark-extract`.
2. **Root Directory:** `apps/client`
3. Env: `VITE_WS_URL` = `wss://YOUR-RAILWAY-DOMAIN` (from step 2)
4. Deploy → share the Vercel link.

---

## If Render already asked for a card

**Close that screen.** Do not add a card unless you want paid hosting.

On Render, a **free** web service only works if you explicitly choose **Instance type → Free** when creating the service. The payment screen is for **paid** instances only. Many people hit that screen by accident.

You can ignore Render and use Railway above.

---

## 100% no signup for server (play while your PC is on)

Good for testing with a friend **today** without any host account for the server:

1. On your PC:

```powershell
cd C:\Users\pc\Documents\dark-extract
npm run dev
```

2. Install Cloudflare tunnel (one time): https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/

3. In a **second** terminal:

```powershell
cloudflared tunnel --url http://localhost:2567
```

4. Copy the `https://something.trycloudflare.com` URL → your **server** URL is:

```text
wss://something.trycloudflare.com
```

5. Put that in `apps/client/.env.local`:

```text
VITE_WS_URL=wss://something.trycloudflare.com
```

6. Run client only, or use Vercel with that env var.

**Catch:** URL changes each time you restart `cloudflared`. Your PC must stay on. **No credit card.**

---

## Comparison

| Option | Card? | Friend can play 24/7? | Stable URL? |
|--------|-------|------------------------|-------------|
| Vercel + Railway | No (trial) / No (Vercel) | Yes* | Yes |
| Vercel + Render Free | No** | Yes* | Yes |
| Vercel + Cloudflare quick tunnel | No | Only while your PC runs | No (changes) |

\* Free tiers may sleep or run out of credits.  
\*\* Only if you choose **Free** instance and never add a payment method.

---

## What to use

- **Want zero payment forms:** Railway + Vercel (this doc).
- **Render keeps asking for card:** Stop using Render; use Railway.
- **Just testing tonight:** `npm run dev` + `cloudflared` (no accounts for server).
