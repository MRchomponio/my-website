"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { ImageUploader } from "@/components/ui/image-uploader";
import { createClient } from "@/lib/supabase/client";
import { profileUpdateSchema } from "@/lib/validations/auth";
import type { Database, Platform, PlayStyle } from "@/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export function ProfileEditForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [username, setUsername] = useState(profile.username);
  const [displayName, setDisplayName] = useState(profile.display_name ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [platform, setPlatform] = useState<Platform | "">(profile.platform ?? "");
  const [playStyle, setPlayStyle] = useState<PlayStyle | "">(profile.play_style ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile.avatar_url);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const parsed = profileUpdateSchema.safeParse({
      username,
      display_name: displayName || null,
      bio: bio || null,
      platform: platform || null,
      play_style: playStyle || null,
      avatar_url: avatarUrl,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }

    setIsLoading(true);
    const supabase = createClient();

    if (parsed.data.username !== profile.username) {
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", parsed.data.username)
        .maybeSingle();
      if (existing) {
        setIsLoading(false);
        setError("این نام کاربری قبلاً گرفته شده.");
        return;
      }
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update(parsed.data)
      .eq("id", profile.id);

    setIsLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSuccess(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">عکس پروفایل</label>
        <ImageUploader
          bucket="avatars"
          value={avatarUrl}
          onChange={setAvatarUrl}
          label=""
          aspectRatio="square"
          shape="circle"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5" htmlFor="username">
          نام کاربری
        </label>
        <Input
          id="username"
          dir="ltr"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5" htmlFor="displayName">
          نام نمایشی
        </label>
        <Input
          id="displayName"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="اختیاری"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5" htmlFor="bio">
          بیوگرافی
        </label>
        <Textarea
          id="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="درباره خودت برای بقیه گیمرها بنویس..."
          maxLength={280}
        />
        <p className="text-xs text-foreground-subtle mt-1 text-left" dir="ltr">
          {bio.length}/280
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1.5" htmlFor="platform">
            پلتفرم
          </label>
          <select
            id="platform"
            value={platform}
            onChange={(e) => setPlatform(e.target.value as Platform | "")}
            className="w-full h-11 rounded-xl bg-background-elevated border border-background-border px-3.5 text-sm text-foreground outline-none focus:border-neon-blue/60 focus:ring-2 focus:ring-neon-blue/20"
          >
            <option value="">تعیین نشده</option>
            <option value="pc">پی‌سی</option>
            <option value="playstation">پلی‌استیشن</option>
            <option value="xbox">ایکس‌باکس</option>
            <option value="mobile">موبایل</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5" htmlFor="playStyle">
            سبک بازی
          </label>
          <select
            id="playStyle"
            value={playStyle}
            onChange={(e) => setPlayStyle(e.target.value as PlayStyle | "")}
            className="w-full h-11 rounded-xl bg-background-elevated border border-background-border px-3.5 text-sm text-foreground outline-none focus:border-neon-blue/60 focus:ring-2 focus:ring-neon-blue/20"
          >
            <option value="">تعیین نشده</option>
            <option value="casual">رفاقتی</option>
            <option value="competitive">رقابتی</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/30 px-3 py-2.5 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="flex items-start gap-2 rounded-xl bg-neon-green/10 border border-neon-green/30 px-3 py-2.5 text-sm text-neon-green-glow">
          <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
          <span>پروفایل بروزرسانی شد.</span>
        </div>
      )}

      <Button type="submit" isLoading={isLoading}>
        ذخیره تغییرات
      </Button>
    </form>
  );
}
