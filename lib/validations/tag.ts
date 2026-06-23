import { z } from "zod";

export const tagFormSchema = z.object({
  name: z.string().min(1, "نام تگ نمی‌تواند خالی باشد").max(30, "نام تگ خیلی طولانی است"),
  description: z.string().max(150, "توضیحات خیلی طولانی است").optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "باید یک رنگ هگزادسیمال معتبر باشد، مثلاً #3b82f6"),
});

export type TagFormInput = z.infer<typeof tagFormSchema>;

export const manualBadgeFormSchema = z.object({
  name: z.string().min(1, "نام بج نمی‌تواند خالی باشد").max(40),
  slug: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9_]+$/, "فقط حروف کوچک انگلیسی، عدد و _"),
  description: z.string().min(1, "توضیحات نمی‌تواند خالی باشد").max(150),
  icon: z.string().min(1, "یک آیکون انتخاب کن"),
});

export type ManualBadgeFormInput = z.infer<typeof manualBadgeFormSchema>;
