import { z } from "zod";

export const roomFormSchema = z.object({
  game_id: z.string().uuid("Choose a game"),
  title: z.string().min(3, "Title must be at least 3 characters").max(80),
  description: z.string().max(500).optional().nullable(),
  mode: z.enum(["casual", "competitive"]),
  max_players: z.coerce
    .number()
    .int()
    .min(2, "At least 2 players")
    .max(20, "Max 20 players"),
  banner_url: z.string().url().optional().nullable(),
});

export type RoomFormInput = z.infer<typeof roomFormSchema>;
