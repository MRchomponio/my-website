import { redirect } from "next/navigation";
import { Navbar } from "@/components/layout/navbar";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { ProfileEditForm } from "@/components/profile/profile-edit-form";

export default async function EditProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectTo=/settings/profile");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">ویرایش پروفایل</h1>
        <Card className="p-6 sm:p-7">
          <ProfileEditForm profile={profile} />
        </Card>
      </main>
    </div>
  );
}
