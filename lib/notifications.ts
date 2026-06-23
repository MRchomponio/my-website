import {
  MessageSquare,
  ChevronUp,
  CheckCircle2,
  Users,
  UserCheck,
  Flag,
  Award,
  Zap,
  Wallet,
  ShoppingBag,
  type LucideIcon,
} from "lucide-react";
import type { NotificationType } from "@/types/database";
import { formatToman } from "@/lib/utils";

interface NotificationDisplay {
  icon: LucideIcon;
  tone: "blue" | "green" | "purple" | "red" | "neutral";
  text: string;
  href: string | null;
}

/**
 * Converts a notification's (type, payload) into something renderable.
 * Payload shapes are documented in supabase/migrations/0007_notifications.sql.
 * Defensive against missing/unexpected payload keys since payload is
 * untyped JSON at the database level.
 */
export function describeNotification(
  type: NotificationType,
  payload: Record<string, unknown>
): NotificationDisplay {
  const str = (key: string) => (typeof payload[key] === "string" ? (payload[key] as string) : "");
  const num = (key: string) => (typeof payload[key] === "number" ? (payload[key] as number) : 0);

  switch (type) {
    case "reply":
      return {
        icon: MessageSquare,
        tone: "blue",
        text: `${str("actor_username") || "یک کاربر"} به پست «${str("post_title") || "بدون عنوان"}» پاسخ داد`,
        href: str("post_id") ? `/posts/${str("post_id")}` : null,
      };
    case "upvote":
      return {
        icon: ChevronUp,
        tone: "blue",
        text: `${str("actor_username") || "یک کاربر"} به پاسخ شما رای مثبت داد`,
        href: str("post_id") ? `/posts/${str("post_id")}` : null,
      };
    case "accepted_answer":
      return {
        icon: CheckCircle2,
        tone: "green",
        text: `پاسخ شما در «${str("post_title") || "یک پست"}» بهترین پاسخ انتخاب شد`,
        href: str("post_id") ? `/posts/${str("post_id")}` : null,
      };
    case "room_join":
      return {
        icon: Users,
        tone: "purple",
        text: `${str("actor_username") || "یک کاربر"} به اتاق «${str("room_title") || ""}» پیوست`,
        href: str("room_id") ? `/rooms/${str("room_id")}` : null,
      };
    case "room_full":
      return {
        icon: UserCheck,
        tone: "purple",
        text: `اتاق «${str("room_title") || ""}» پر شد`,
        href: str("room_id") ? `/rooms/${str("room_id")}` : null,
      };
    case "report_result": {
      const isValid = str("status") === "valid";
      return {
        icon: Flag,
        tone: isValid ? "green" : "red",
        text: isValid
          ? "گزارش شما بررسی و معتبر تایید شد"
          : "گزارش شما بررسی و نامعتبر اعلام شد",
        href: null,
      };
    }
    case "badge_earned":
      return {
        icon: Award,
        tone: "purple",
        text: `بج «${str("badge_name") || ""}» رو دریافت کردی!`,
        href: "/badges",
      };
    case "level_up":
      return {
        icon: Zap,
        tone: "blue",
        text: `به سطح ${num("new_level") || "?"} رسیدی!`,
        href: null,
      };
    case "wallet_topup_result": {
      const isApproved = str("status") === "approved";
      const amount = num("amount_rials");
      return {
        icon: Wallet,
        tone: isApproved ? "green" : "red",
        text: isApproved
          ? `درخواست شارژ کیف‌پول به مبلغ ${formatToman(amount)} تومان تایید شد`
          : "درخواست شارژ کیف‌پول شما رد شد",
        href: "/wallet",
      };
    }
    case "currency_order_delivered":
      return {
        icon: ShoppingBag,
        tone: "green",
        text: `سفارش «${str("product_name") || ""}» تحویل داده شد`,
        href: "/shop/orders",
      };
    case "currency_order_cancelled": {
      const refund = num("refund_rials");
      return {
        icon: ShoppingBag,
        tone: "red",
        text: `سفارش «${str("product_name") || ""}» لغو شد و مبلغ ${formatToman(refund)} تومان به کیف‌پولت برگشت`,
        href: "/wallet",
      };
    }
    case "listing_review_result": {
      const approved = payload?.approved === true;
      return {
        icon: ShoppingBag,
        tone: approved ? "green" : "red",
        text: approved
          ? `آگهی «${str("title")}» تایید شد و در مارکت‌پلیس نمایش داده می‌شه`
          : `آگهی «${str("title")}» رد شد${str("reason") ? `: ${str("reason")}` : ""}`,
        href: "/marketplace/my-listings",
      };
    }
    case "listing_sold":
      return {
        icon: ShoppingBag,
        tone: "green",
        text: `آگهی «${str("title")}» فروخته شد — ${formatToman(num("payout_rials"))} تومان به کیف‌پولت اضافه شد`,
        href: "/marketplace/my-listings",
      };
    case "listing_purchased":
      return {
        icon: ShoppingBag,
        tone: "blue",
        text: `خرید «${str("title")}» با موفقیت انجام شد`,
        href: "/marketplace/purchases",
      };
    case "listing_removed":
      return {
        icon: ShoppingBag,
        tone: "red",
        text: `آگهی «${str("title")}» توسط ادمین حذف شد${str("reason") ? `: ${str("reason")}` : ""}`,
        href: "/marketplace/my-listings",
      };
    case "item_listing_sold":
      return {
        icon: ShoppingBag,
        tone: "green",
        text: `آیتم «${str("name")}» فروخته شد — ${formatToman(num("payout_rials"))} تومان به کیف‌پولت اضافه شد`,
        href: "/trade/my-listings",
      };
    case "item_listing_purchased":
      return {
        icon: ShoppingBag,
        tone: "blue",
        text: `خرید آیتم «${str("name")}» با موفقیت انجام شد`,
        href: "/trade/purchases",
      };
    case "item_listing_removed":
      return {
        icon: ShoppingBag,
        tone: "red",
        text: `آگهی آیتم «${str("name")}» توسط ادمین حذف شد${str("reason") ? `: ${str("reason")}` : ""}`,
        href: "/trade/my-listings",
      };
    default:
      return {
        icon: MessageSquare,
        tone: "neutral",
        text: "یک رویداد جدید",
        href: null,
      };
  }
}
