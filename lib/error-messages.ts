/**
 * Translates common raw Postgres/Supabase error messages into
 * user-facing Persian text. Falls back to a generic message rather than
 * showing raw English database errors (e.g. from RAISE EXCEPTION in
 * trigger functions, or constraint violations) directly to the user.
 */
export function translateDbError(message: string): string {
  const lower = message.toLowerCase();

  if (lower.includes("rate limit exceeded")) {
    return "تعداد درخواست‌هات تو این بازه‌ی زمانی زیاد بوده. کمی صبر کن و دوباره امتحان کن.";
  }
  if (lower.includes("duplicate key") || lower.includes("already exists")) {
    return "این مورد قبلاً ثبت شده است.";
  }
  if (lower.includes("violates row-level security") || lower.includes("permission denied")) {
    return "اجازه‌ی انجام این کار رو نداری.";
  }
  if (lower.includes("violates foreign key constraint")) {
    return "این مورد دیگر معتبر نیست (ممکن است حذف شده باشد).";
  }
  if (lower.includes("violates check constraint")) {
    return "اطلاعات وارد شده معتبر نیست.";
  }
  if (lower.includes("only admins")) {
    return "این عملیات فقط برای ادمین مجاز است.";
  }

  return "مشکلی پیش اومد. لطفاً دوباره امتحان کن.";
}
