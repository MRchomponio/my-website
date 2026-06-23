import { z } from "zod";

export const currencyProductFormSchema = z.object({
  game_id: z.string().uuid("یک بازی انتخاب کن"),
  name: z.string().min(2, "نام باید حداقل ۲ کاراکتر باشد").max(100),
  description: z.string().max(500).optional().nullable(),
  image_url: z.string().url().optional().nullable(),
  // Prices are entered in toman in the UI and converted to rials (×10)
  // before reaching this schema — see currency-product-form.tsx.
  price_rials: z
    .number({ invalid_type_error: "قیمت باید عدد باشد" })
    .int()
    .positive("قیمت باید بیشتر از صفر باشد"),
  currency_amount: z
    .number({ invalid_type_error: "مقدار باید عدد باشد" })
    .int()
    .positive("مقدار واحد پول باید بیشتر از صفر باشد"),
  currency_unit_label: z.string().max(30).optional().nullable(),
  is_active: z.boolean(),
  display_order: z.number().int(),
});

export type CurrencyProductFormInput = z.infer<typeof currencyProductFormSchema>;

export const currencyPurchaseFormSchema = z.object({
  game_account_info: z
    .string()
    .trim()
    .min(1, "اطلاعات اکانت بازی رو وارد کن تا بدونیم ارز رو کجا تحویل بدیم")
    .max(300, "متن خیلی طولانی است"),
});

export type CurrencyPurchaseFormInput = z.infer<typeof currencyPurchaseFormSchema>;

// ─── Account Marketplace ─────────────────────────────────────────────────────

export const accountListingFormSchema = z.object({
  game_id: z.string().uuid("یک بازی انتخاب کن"),
  title: z
    .string()
    .min(3, "عنوان باید حداقل ۳ کاراکتر باشد")
    .max(150, "عنوان نباید بیشتر از ۱۵۰ کاراکتر باشد"),
  description: z
    .string()
    .min(10, "توضیحات باید حداقل ۱۰ کاراکتر باشد")
    .max(3000, "توضیحات نباید بیشتر از ۳۰۰۰ کاراکتر باشد"),
  image_urls: z.array(z.string().url()).max(6, "حداکثر ۶ تصویر مجاز است"),
  price_rials: z
    .number({ invalid_type_error: "قیمت باید عدد باشد" })
    .int()
    .positive("قیمت باید بیشتر از صفر باشد"),
  delivery_instructions: z
    .string()
    .min(1, "اطلاعات تحویل رو وارد کن (مثلاً رمز اکانت)")
    .max(1000, "متن خیلی طولانی است"),
});

export type AccountListingFormInput = z.infer<typeof accountListingFormSchema>;

// ─── Trade Items ─────────────────────────────────────────────────────────────

export const itemListingFormSchema = z.object({
  game_id: z.string().uuid("یک بازی انتخاب کن"),
  name: z.string().min(2, "نام باید حداقل ۲ کاراکتر باشد").max(100),
  description: z
    .string()
    .min(5, "توضیحات باید حداقل ۵ کاراکتر باشد")
    .max(2000, "توضیحات نباید بیشتر از ۲۰۰۰ کاراکتر باشد"),
  image_urls: z.array(z.string().url()).max(6),
  price_rials: z
    .number({ invalid_type_error: "قیمت باید عدد باشد" })
    .int()
    .positive("قیمت باید بیشتر از صفر باشد"),
  contact_info: z
    .string()
    .min(1, "اطلاعات تماس رو وارد کن (مثلاً آیدی بازی)")
    .max(300),
  quantity: z
    .number({ invalid_type_error: "تعداد باید عدد باشد" })
    .int()
    .min(1, "تعداد باید حداقل ۱ باشد")
    .max(9999),
});

export type ItemListingFormInput = z.infer<typeof itemListingFormSchema>;
