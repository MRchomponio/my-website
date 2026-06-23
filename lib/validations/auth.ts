import { z } from "zod";

export const usernameSchema = z
  .string()
  .min(3, "نام کاربری باید حداقل ۳ کاراکتر باشد")
  .max(20, "نام کاربری نباید بیشتر از ۲۰ کاراکتر باشد")
  .regex(
    /^[a-zA-Z0-9_]+$/,
    "نام کاربری فقط می‌تواند شامل حروف انگلیسی، عدد و _ باشد"
  );

export const registerSchema = z
  .object({
    username: usernameSchema,
    email: z.string().email("ایمیل معتبر نیست"),
    password: z.string().min(8, "رمز عبور باید حداقل ۸ کاراکتر باشد"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "رمزهای عبور مطابقت ندارند",
    path: ["confirmPassword"],
  });

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email("ایمیل معتبر نیست"),
  password: z.string().min(1, "رمز عبور را وارد کنید"),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const profileUpdateSchema = z.object({
  username: usernameSchema,
  display_name: z.string().max(40).optional().nullable(),
  bio: z.string().max(280, "بیوگرافی نباید بیشتر از ۲۸۰ کاراکتر باشد").optional().nullable(),
  platform: z.enum(["pc", "playstation", "xbox", "mobile"]).optional().nullable(),
  play_style: z.enum(["casual", "competitive"]).optional().nullable(),
  avatar_url: z.string().url().optional().nullable(),
});

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
