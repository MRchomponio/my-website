import { z } from "zod";

export const gameSlugSchema = z
  .string()
  .min(2, "Slug must be at least 2 characters")
  .max(40, "Slug must be under 40 characters")
  .regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens");

export const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex color, e.g. #3b82f6");

export const gameFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(60),
  slug: gameSlugSchema,
  description: z.string().max(300).optional().nullable(),
  accent_color: hexColorSchema,
  banner_url: z.string().url().optional().nullable(),
  icon_url: z.string().url().optional().nullable(),
});

export type GameFormInput = z.infer<typeof gameFormSchema>;
