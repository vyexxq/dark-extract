# Dark Extract — Game Design (Summary)

See project README for technical setup. Full vision: hub → dungeon contract → instanced run → extract → craft/trade in town.

## Phase roadmap

| Phase | Scope |
|-------|--------|
| **0** ✅ | Hub greybox, multiplayer movement, shared protocol |
| **1** ✅ | Solo dungeon: goblins, loot, extract, death penalty B, proc gen |
| **2** ✅ | Duo/trio sync combat, goblin cave template, accounts, XP levels |
| **3** | Crafting sinks, player market stalls |
| **4** | Dark Knight world event, legendary materials |
| **5** | Lazy-mint chain layer (withdraw/trade only) |

## Core pillars

- Extraction loop, not open-world MMO
- Reputation progression (no XP levels)
- Crafting destroys materials (economy sinks)
- Blockchain only for legendary/cosmetic/guild assets on withdraw
- Dark Knight: rare instanced boss, server-wide fame

## Economy rules (enforced in code later)

- Best gear requires dungeon materials + reputation
- Legendary supply caps per recipe epoch
- Market taxes scale with seller dominance
- Seasonal influence reset (not item wipe)
