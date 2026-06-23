import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * All money in the database (wallets.balance_rials, wallet_topup_requests
 * .amount_rials, and every Marketplace price column that follows) is
 * stored in rials, the smallest commonly-used unit, to avoid fractional
 * values. The UI displays toman (rials / 10) since that's the unit
 * Iranian users expect to read. Uses "en-US" rather than "fa-IR" purely
 * for thousand-separator grouping — it keeps digits in Latin numerals
 * (0-9) to match every other number in this project (usernames, dates,
 * counts), rather than switching to Persian numerals (۰-۹) only for
 * money. Always go through this helper rather than dividing inline so
 * the unit conversion lives in exactly one place.
 */
export function formatToman(amountRials: number): string {
  return Math.round(amountRials / 10).toLocaleString("en-US");
}
