import {
  Lightbulb,
  ShieldCheck,
  Flame,
  Award,
  Crown,
  Star,
  Trophy,
  Heart,
  Gem,
  Skull,
  Swords,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

/**
 * Maps the `icon` string stored in the badges table (seeded in
 * 0006_xp_levels_badges.sql, extended in 0011_avatars_and_admin_tags.sql)
 * to an actual lucide-react component.
 * Add an entry here whenever a new badge with a new icon is seeded.
 */
export const BADGE_ICONS: Record<string, LucideIcon> = {
  Lightbulb,
  ShieldCheck,
  Flame,
  Award,
  Crown,
  Star,
  Trophy,
  Heart,
  Gem,
  Skull,
  Swords,
  Sparkles,
};

export function getBadgeIcon(iconName: string): LucideIcon {
  return BADGE_ICONS[iconName] ?? Award;
}
