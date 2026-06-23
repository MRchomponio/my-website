import type { Metadata } from "next";
import { Vazirmatn } from "next/font/google";
import "./globals.css";

const vazirmatn = Vazirmatn({
  subsets: ["arabic"],
  variable: "--font-vazirmatn",
});

export const metadata: Metadata = {
  title: "گیم‌هاب — جامعه گیمرها",
  description:
    "پلتفرم اجتماعی برای گیمرها: انجمن اختصاصی هر بازی، پیدا کردن هم‌تیمی، و ساختن هویت گیمینگ شما.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" className="dark">
      <body
        className={`${vazirmatn.variable} antialiased min-h-screen bg-background font-sans`}
      >
        {children}
      </body>
    </html>
  );
}
