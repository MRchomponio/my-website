"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { Upload, X, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface ImageUploaderProps {
  bucket: "game-assets" | "room-banners" | "avatars" | "payment-receipts" | "listing-images";
  value: string | null;
  onChange: (url: string | null) => void;
  label: string;
  aspectRatio?: "square" | "banner";
  shape?: "rounded" | "circle";
}

const BUCKET_LIMITS: Record<
  ImageUploaderProps["bucket"],
  { maxBytes: number; acceptedTypes: string[]; isPrivate: boolean }
> = {
  "game-assets": {
    maxBytes: 4 * 1024 * 1024,
    acceptedTypes: ["image/png", "image/jpeg", "image/webp", "image/gif"],
    isPrivate: false,
  },
  "room-banners": {
    maxBytes: 4 * 1024 * 1024,
    acceptedTypes: ["image/png", "image/jpeg", "image/webp", "image/gif"],
    isPrivate: false,
  },
  avatars: {
    // Matches the storage.buckets file_size_limit / allowed_mime_types
    // set server-side in migration 0011 — keep these two in sync.
    maxBytes: 2 * 1024 * 1024,
    acceptedTypes: ["image/png", "image/jpeg", "image/webp"],
    isPrivate: false,
  },
  "payment-receipts": {
    maxBytes: 4 * 1024 * 1024,
    acceptedTypes: ["image/png", "image/jpeg", "image/webp"],
    isPrivate: true,
  },
  "listing-images": {
    maxBytes: 4 * 1024 * 1024,
    acceptedTypes: ["image/png", "image/jpeg", "image/webp"],
    isPrivate: false,
  },
};

// Helper function to generate UUID with fallback for older browsers
function generateUUID(): string {
  // Check if crypto.randomUUID is available (modern browsers with HTTPS)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback for older browsers or non-HTTPS environments
  // Using a more robust UUID v4 implementation
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export function ImageUploader({
  bucket,
  value,
  onChange,
  label,
  aspectRatio = "banner",
  shape = "rounded",
}: ImageUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { maxBytes, acceptedTypes, isPrivate } = BUCKET_LIMITS[bucket];

  // For private buckets, `value` is a storage path, not a displayable
  // URL — resolve a signed URL for local preview whenever it changes.
  // For public buckets, `value` is already a usable URL.
  useEffect(() => {
    if (!value) {
      setPreviewUrl(null);
      return;
    }
    if (!isPrivate) {
      setPreviewUrl(value);
      return;
    }

    let cancelled = false;
    const supabase = createClient();
    supabase.storage
      .from(bucket)
      .createSignedUrl(value, 300) // 5 minutes — long enough for a preview/review session
      .then(({ data }) => {
        if (!cancelled) setPreviewUrl(data?.signedUrl ?? null);
      });

    return () => {
      cancelled = true;
    };
  }, [value, isPrivate, bucket]);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    if (!acceptedTypes.includes(file.type)) {
      setError(
        acceptedTypes.includes("image/gif")
          ? "فرمت PNG، JPEG، WEBP یا GIF استفاده کن."
          : "فرمت PNG، JPEG یا WEBP استفاده کن."
      );
      return;
    }
    if (file.size > maxBytes) {
      setError(`حجم فایل باید کمتر از ${Math.round(maxBytes / (1024 * 1024))} مگابایت باشد.`);
      return;
    }

    setIsUploading(true);
    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setIsUploading(false);
      setError("برای آپلود عکس باید وارد حساب بشی.");
      return;
    }

    const ext = file.name.split(".").pop();
    // Use the generateUUID function instead of crypto.randomUUID directly
    const path = `${user.id}/${generateUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, file, { cacheControl: "3600", upsert: false });

    setIsUploading(false);

    if (uploadError) {
      setError(uploadError.message);
      return;
    }

    if (isPrivate) {
      // Hand the caller the storage path; they store this value as-is
      // (e.g. wallet_topup_requests.receipt_image_url) and resolve a
      // fresh signed URL whenever it needs displaying later.
      onChange(path);
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(path);
    onChange(publicUrl);
  }

  return (
    <div>
      {label && <label className="block text-sm font-medium mb-1.5">{label}</label>}

      {value ? (
        <div
          className={cn(
            "relative overflow-hidden border border-background-border group",
            shape === "circle" ? "rounded-full" : "rounded-xl",
            aspectRatio === "square" ? "w-24 h-24" : "w-full aspect-[3/1]"
          )}
        >
          {previewUrl ? (
            <Image src={previewUrl} alt={label || "تصویر آپلودشده"} fill className="object-cover" unoptimized />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-background-elevated">
              <Loader2 className="h-5 w-5 animate-spin text-foreground-subtle" />
            </div>
          )}
          <button
            type="button"
            onClick={async () => {
              // For public buckets value is a full URL; extract the path
              // (everything after /object/public/{bucket}/) for the remove call.
              // For private buckets value IS already the path.
              if (value) {
                try {
                  const supabase = createClient();
                  let storagePath = value;
                  if (!isPrivate) {
                    // Extract path from public URL:
                    // https://{project}.supabase.co/storage/v1/object/public/{bucket}/{path}
                    const marker = `/object/public/${bucket}/`;
                    const idx = value.indexOf(marker);
                    if (idx !== -1) storagePath = value.slice(idx + marker.length);
                  }
                  await supabase.storage.from(bucket).remove([storagePath]);
                } catch {
                  // Non-critical — the DB reference will be cleared even
                  // if the storage delete fails (e.g. file already gone).
                }
              }
              onChange(null);
            }}
            className="absolute top-1.5 right-1.5 p-1 rounded-lg bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="حذف عکس"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
          className={cn(
            "flex flex-col items-center justify-center gap-1.5 border border-dashed border-background-border bg-background-elevated text-foreground-muted hover:border-neon-blue/50 hover:text-foreground transition-colors disabled:opacity-60",
            shape === "circle" ? "rounded-full" : "rounded-xl",
            aspectRatio === "square" ? "w-24 h-24" : "w-full aspect-[3/1]"
          )}
        >
          {isUploading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              <Upload className="h-5 w-5" />
              <span className="text-xs">آپلود</span>
            </>
          )}
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={acceptedTypes.join(",")}
        onChange={handleFileSelect}
        className="hidden"
      />

      {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
    </div>
  );
}