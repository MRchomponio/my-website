"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Loader2, ImageOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/**
 * Displays an image stored in a PRIVATE Supabase Storage bucket (e.g.
 * "payment-receipts") by resolving a short-lived signed URL client-side.
 * RLS on storage.objects still governs who's actually allowed to fetch
 * the signed URL in the first place (see migration 0013's "users can
 * read their own payment receipts" / "admins can read all payment
 * receipts" policies) — this component just handles the display
 * mechanics, it grants no access by itself.
 */
export function PrivateImage({
  bucket,
  path,
  alt,
  className,
}: {
  bucket: string;
  path: string;
  alt: string;
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    setFailed(false);

    const supabase = createClient();
    supabase.storage
      .from(bucket)
      .createSignedUrl(path, 300)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data?.signedUrl) {
          setFailed(true);
          return;
        }
        setUrl(data.signedUrl);
      });

    return () => {
      cancelled = true;
    };
  }, [bucket, path]);

  if (failed) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-background-elevated text-foreground-subtle",
          className
        )}
      >
        <ImageOff className="h-5 w-5" />
      </div>
    );
  }

  if (!url) {
    return (
      <div className={cn("flex items-center justify-center bg-background-elevated", className)}>
        <Loader2 className="h-5 w-5 animate-spin text-foreground-subtle" />
      </div>
    );
  }

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={cn("relative block", className)}>
      <Image src={url} alt={alt} fill className="object-cover" unoptimized />
    </a>
  );
}
