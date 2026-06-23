import { Navbar } from "@/components/layout/navbar";
import { Card } from "@/components/ui/card";
import { requireUser } from "@/lib/auth-helpers";
import { CreateItemListingForm } from "@/components/trade/create-item-listing-form";

export default async function NewItemListingPage() {
  const { supabase } = await requireUser();
  const { data: games } = await supabase.from("games").select("id, name, accent_color").order("name");

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">فروش آیتم</h1>
          <p className="text-sm text-foreground-muted mt-1">آگهیت بلافاصله در بازار نمایش داده میشه.</p>
        </div>
        <Card className="p-6"><CreateItemListingForm games={games ?? []} /></Card>
      </main>
    </div>
  );
}
