import { Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { TagPill } from "@/components/tags/tag-pill";
import { createClient } from "@/lib/supabase/server";
import { TagForm } from "@/components/admin/tag-form";
import { DeleteTagButton } from "@/components/admin/delete-tag-button";

export default async function AdminTagsPage() {
  const supabase = await createClient();
  const { data: tags } = await supabase
    .from("tags")
    .select("*")
    .order("name");

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">تگ‌ها</h1>
        <p className="text-sm text-foreground-muted mt-1">
          تگ‌های قابل تخصیص به کاربران رو مدیریت کن.
        </p>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        <div className="space-y-3 order-2 lg:order-1">
          {!tags || tags.length === 0 ? (
            <Card className="p-10 text-center text-foreground-muted">
              هنوز هیچ تگی ساخته نشده.
            </Card>
          ) : (
            tags.map((tag) => (
              <Card key={tag.id} className="p-4 flex items-center gap-4">
                <TagPill name={tag.name} color={tag.color} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground-muted truncate">
                    {tag.description || "بدون توضیحات"}
                  </p>
                </div>
                <DeleteTagButton tagId={tag.id} tagName={tag.name} />
              </Card>
            ))
          )}
        </div>

        <div className="order-1 lg:order-2">
          <Card className="p-5">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold mb-4">
              <Plus className="h-4 w-4" />
              تگ جدید
            </h2>
            <TagForm />
          </Card>
        </div>
      </div>
    </div>
  );
}
