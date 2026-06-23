/**
 * Mirrors the SQL functions xp_to_level() and xp_for_level() defined in
 * supabase/migrations/0006_xp_levels_badges.sql, so the UI can render a
 * progress bar without an extra round trip. Keep these two in sync if
 * the formula ever changes.
 */

export function xpForLevel(level: number): number {
  return Math.floor(Math.pow(Math.max(level, 1) - 1, 2) * 50);
}

export function xpToLevel(xp: number): number {
  return Math.floor(Math.sqrt(Math.max(xp, 0) / 50)) + 1;
}

export function levelProgress(xp: number, level: number) {
  const currentLevelXp = xpForLevel(level);
  const nextLevelXp = xpForLevel(level + 1);
  const span = nextLevelXp - currentLevelXp;
  const progressXp = xp - currentLevelXp;
  const percent = span > 0 ? Math.min(100, Math.max(0, (progressXp / span) * 100)) : 100;

  return {
    currentLevelXp,
    nextLevelXp,
    progressXp,
    remainingXp: Math.max(0, nextLevelXp - xp),
    percent,
  };
}
