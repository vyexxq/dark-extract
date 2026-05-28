/** Hunter level 1–20; XP from dungeon kills */

export const MAX_LEVEL = 20;

export interface PlayerProgression {
  level: number;
  xp: number;
}

export const DEFAULT_PROGRESSION: PlayerProgression = { level: 1, xp: 0 };

/** Total XP required to reach `level` (level 1 = 0) */
export function xpRequiredForLevel(level: number): number {
  if (level <= 1) return 0;
  let total = 0;
  for (let l = 1; l < level; l++) {
    total += xpToNextLevel(l);
  }
  return total;
}

export function xpToNextLevel(level: number): number {
  return 40 + level * 25;
}

export function maxHpForLevel(level: number): number {
  return 100 + (Math.min(level, MAX_LEVEL) - 1) * 12;
}

export function slashDamageForLevel(level: number, riposte: boolean): number {
  const base = 12 + Math.floor(level / 2);
  return riposte ? base + 14 : base;
}

export function xpRewardForKill(enemyKind: "goblin" | "shambler"): number {
  return enemyKind === "shambler" ? 28 : 16;
}

export interface LevelUpResult {
  progression: PlayerProgression;
  leveledUp: boolean;
  newLevel?: number;
}

export function addXp(
  progression: PlayerProgression,
  amount: number,
): LevelUpResult {
  let { level, xp } = progression;
  xp += amount;
  let leveledUp = false;
  let newLevel: number | undefined;

  while (level < MAX_LEVEL) {
    const need = xpToNextLevel(level);
    const have = xp - xpRequiredForLevel(level);
    if (have < need) break;
    level += 1;
    leveledUp = true;
    newLevel = level;
  }

  if (level >= MAX_LEVEL) {
    const cap = xpRequiredForLevel(MAX_LEVEL) + xpToNextLevel(MAX_LEVEL);
    xp = Math.min(xp, cap);
  }

  return { progression: { level, xp }, leveledUp, newLevel };
}

export function xpProgressInLevel(progression: PlayerProgression): {
  current: number;
  needed: number;
} {
  const base = xpRequiredForLevel(progression.level);
  const needed = progression.level >= MAX_LEVEL ? 1 : xpToNextLevel(progression.level);
  const current =
    progression.level >= MAX_LEVEL
      ? needed
      : Math.max(0, progression.xp - base);
  return { current, needed };
}
