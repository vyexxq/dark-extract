export type MaterialId = "goblin_tooth" | "cave_moss" | "iron_shard";

export interface MaterialStack {
  id: MaterialId;
  qty: number;
}

export interface PlayerInventory {
  materials: MaterialStack[];
  gold: number;
}

export const EMPTY_INVENTORY: PlayerInventory = {
  materials: [],
  gold: 0,
};

export function addMaterial(
  inv: PlayerInventory,
  id: MaterialId,
  qty: number,
): PlayerInventory {
  const materials = inv.materials.map((m) => ({ ...m }));
  const existing = materials.find((m) => m.id === id);
  if (existing) existing.qty += qty;
  else materials.push({ id, qty });
  return { ...inv, materials };
}

export function mergeInventory(
  base: PlayerInventory,
  run: PlayerInventory,
): PlayerInventory {
  let next = { ...base, gold: base.gold + run.gold };
  for (const stack of run.materials) {
    next = addMaterial(next, stack.id, stack.qty);
  }
  return next;
}
