import { z } from "zod";

export const reportTargetTypeSchema = z.enum(["post", "reply", "user", "room"]);

export const reportFormSchema = z.object({
  target_type: reportTargetTypeSchema,
  target_id: z.string().uuid(),
  target_user_id: z.string().uuid().optional().nullable(),
  reason: z
    .string()
    .min(5, "لطفاً دلیل گزارش رو با جزییات بیشتری بنویس (حداقل ۵ کاراکتر)")
    .max(500, "متن گزارش خیلی طولانیه"),
});

export type ReportFormInput = z.infer<typeof reportFormSchema>;
