# Dark Extract

Dark fantasy multiplayer dungeon extraction game — browser-based, modular architecture.

**Phase 2 (current):** Accounts, XP/levels, party dungeons (2–3), server-synced combat & loot, goblin cave template.

## Art assets

**You do not need to add any PNG files.** Tiles, player, and enemies are drawn at runtime into sprite sheets (see `apps/client/src/game/art/TextureFactory.ts`). Later you can drop real pixel-art PNGs into `apps/client/public/assets/` and load them in `BootScene` instead.

## Play online with friends

**Start here:** **[docs/YOUR_SETUP_STEPS.md](docs/YOUR_SETUP_STEPS.md)** (Vercel + Render).  
**Card on Render — stay $0:** **[docs/RENDER_STAY_FREE.md](docs/RENDER_STAY_FREE.md)**.

## Quick start

```bash
cd C:\Users\pc\Documents\dark-extract
npm install
npm run dev
```

- **Client:** http://localhost:5173
- **Server:** ws://localhost:2567

1. Click the game canvas (keyboard focus)
2. WASD to move in town
3. Walk to **Contracts** (center-north) and press **E**
4. In dungeon: **SPACE** to attack, reach the **green extract tile** to keep loot
5. Open two tabs with server running for hub multiplayer

**Death (penalty B):** dying in a run loses unextracted loot; saved inventory in town is kept.

## Project structure

```
dark-extract/
├── apps/
│   ├── client/     React + Phaser 3 (game rendering)
│   └── server/     Node WebSocket hub
├── packages/
│   └── shared/     Types, constants, network protocol
└── docs/
    └── GDD.md      Game design reference
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start server + client together |
| `npm run dev:server` | Hub server only |
| `npm run dev:client` | Client only |
| `npm run build` | Build all packages |

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `2567` | WebSocket server port |
| `VITE_WS_URL` | `ws://localhost:2567` | Client WebSocket URL |
