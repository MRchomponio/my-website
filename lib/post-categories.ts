import { HelpCircle, BookOpen, Bug, MessageCircle, type LucideIcon } from "lucide-react";
import type { PostCategory } from "@/types/database";

export const POST_CATEGORIES: {
  value: PostCategory;
  label: string;
  icon: LucideIcon;
  tone: "blue" | "green" | "red" | "purple";
}[] = [
  { value: "question", label: "سوال", icon: HelpCircle, tone: "blue" },
  { value: "tutorial", label: "آموزش", icon: BookOpen, tone: "green" },
  { value: "bug", label: "گزارش باگ", icon: Bug, tone: "red" },
  { value: "discussion", label: "بحث آزاد", icon: MessageCircle, tone: "purple" },
];

export function getCategoryMeta(category: PostCategory) {
  return POST_CATEGORIES.find((c) => c.value === category)!;
}
