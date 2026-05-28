# Render with a card on file — stay $0

## STOP if the screen says Starter $7

If **Blueprints** preview shows `(Starter) $7 / month` — **do not click deploy**.

Render blueprints often default to **Starter** even when `render.yaml` says `plan: free`. Use **manual Web Service** steps below instead.

---

Adding a card does **not** mean you pay monthly. You only pay if you use **paid** instance types or go over free limits.

## The #1 rule: instance type must be **Free**

In the Render dashboard → your **dark-extract-server** service → **Settings** → **Instance type**:

- Must say **Free** ($0)
- **Not** Starter, Standard, Pro, etc. (those charge ~$7+/month)

Our `render.yaml` includes `plan: free`, but the blueprint UI may still show $7. **Ignore the blueprint** and create the service manually:

### Create server manually (Free, $0)

1. Render Dashboard → **New +** → **Web Service** (not Blueprint).
2. Connect GitHub → repo `dark-extract`.
3. **Name:** `dark-extract-server`
4. **Root Directory:** leave blank (repo root)
5. **Build Command:**
   ```bash
   npm install && npm run build -w @dark-extract/shared && npm run build -w @dark-extract/server
   ```
6. **Start Command:**
   ```bash
   npm run start -w @dark-extract/server
   ```
7. **Instance type:** scroll and pick **Free** (not Starter).
8. Create Web Service → wait until Live.

Estimated pricing should show **$0** before you confirm.

If you already created the service on **Starter**, change it to **Free** in Settings, or delete it and follow the steps above.

---

## What stays free (Hobby workspace)

| Included | Limit |
|----------|--------|
| Web service on **Free** instance | $0 compute for that tier |
| Instance hours | 750 hours/month across free services |
| Sleep when idle | 15 min no traffic → ~1 min wake on next visit |
| Static sites on Vercel | Separate; also free for hobby |

---

## When Render *could* charge your card

Only in these cases:

1. **Paid instance type** (Starter/Standard/…) — avoid; use **Free**.
2. **Outbound bandwidth** over the monthly included amount (unlikely for a small game with friends).
3. **Build pipeline minutes** over the included amount (unlikely unless you deploy dozens of times per day).
4. You add a **paid Postgres** or other paid add-ons (this project does not need a Render database).

If you stay on **Free** instance and normal usage, monthly bill should be **$0**.

---

## Safety checks (do once)

1. **Billing** → confirm no paid services listed at Starter+ pricing.
2. **dark-extract-server** → Settings → **Instance type: Free**.
3. Optional: **Billing** → set a **spend limit** of **$0** or **$1** if Render offers it for pipeline overages.
4. Do **not** add Render Postgres unless you upgrade it on purpose (free DB expires in 30 days anyway).

---

## Stack with Render

| Part | Host |
|------|------|
| Server | Render (`plan: free` in `render.yaml`) |
| Game | Vercel + `VITE_WS_URL=wss://your-service.onrender.com` |

Full steps: [YOUR_SETUP_STEPS.md](./YOUR_SETUP_STEPS.md) (Render section).

---

## If you see a charge

- Check instance type first (almost always the cause).
- Render emails you before many overage situations.
- Downgrade to **Free** or remove paid services in the dashboard.
