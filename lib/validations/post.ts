import { z } from "zod";

export const postCategorySchema = z.enum([
  "question",
  "tutorial",
  "bug",
  "discussion",
]);

export const postFormSchema = z.object({
  game_id: z.string().uuid("یه بازی انتخاب کن"),
  title: z
    .string()
    .min(5, "عنوان باید حداقل ۵ کاراکتر باشه")
    .max(150, "عنوان نباید بیشتر از ۱۵۰ کاراکتر باشه"),
  body: z
    .string()
    .min(1, "متن پست نمی‌تونه خالی باشه")
    .max(10000, "متن پست خیلی طولانیه"),
  category: postCategorySchema,
});

export type PostFormInput = z.infer<typeof postFormSchema>;

export const replyFormSchema = z.object({
  post_id: z.string().uuid(),
  body: z
    .string()
    .min(1, "متن پاسخ نمی‌تونه خالی باشه")
    .max(5000, "متن پاسخ خیلی طولانیه"),
});

export type ReplyFormInput = z.infer<typeof replyFormSchema>;
