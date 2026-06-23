import { z } from "zod";

// Minimum top-up amount in rials (10,000 toman) — keeps a single request
// from being created for a trivially small/meaningless amount; admins
// review every request manually so this also bounds their workload.
const MIN_AMOUNT_RIALS = 100_000;
// Maximum a single request can ask for; large legitimate top-ups should
// be split into multiple requests so no single admin approval moves an
// outsized amount of money at once.
const MAX_AMOUNT_RIALS = 500_000_000;

export const walletTopupFormSchema = z.object({
  amount_rials: z
    .number({ invalid_type_error: "مبلغ باید عدد باشد" })
    .int("مبلغ باید عدد صحیح باشد")
    .min(MIN_AMOUNT_RIALS, `حداقل مبلغ شارژ ${MIN_AMOUNT_RIALS / 10} تومان است`)
    .max(MAX_AMOUNT_RIALS, `حداکثر مبلغ شارژ در هر درخواست ${MAX_AMOUNT_RIALS / 10} تومان است`),
  receipt_image_url: z.string().min(1, "آپلود تصویر رسید پرداخت الزامی است"),
  reference_note: z
    .string()
    .trim()
    .min(3, "کد پیگیری یا توضیح تراکنش را وارد کن (حداقل ۳ کاراکتر)")
    .max(200, "متن خیلی طولانی است"),
});

export type WalletTopupFormInput = z.infer<typeof walletTopupFormSchema>;
