import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Extracts the object path inside a bucket from either a stored public/signed URL
 * (e.g. ".../storage/v1/object/public/<bucket>/<path>") or a raw path.
 */
export function extractStoragePath(bucket: string, urlOrPath: string | null | undefined): string | null {
  if (!urlOrPath) return null;
  const value = String(urlOrPath);
  if (!/^https?:\/\//i.test(value)) return value;
  const markers = [
    `/storage/v1/object/public/${bucket}/`,
    `/storage/v1/object/sign/${bucket}/`,
    `/storage/v1/object/authenticated/${bucket}/`,
  ];
  for (const m of markers) {
    const idx = value.indexOf(m);
    if (idx >= 0) return value.slice(idx + m.length).split("?")[0];
  }
  return null;
}

/**
 * Generates a short-lived signed URL for a stored file (private bucket).
 * Accepts either a stored URL or a raw path.
 */
export async function getSignedFileUrl(
  bucket: string,
  urlOrPath: string | null | undefined,
  expiresInSeconds = 3600,
): Promise<string | null> {
  const path = extractStoragePath(bucket, urlOrPath);
  if (!path) return null;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
  if (error || !data) return null;
  return data.signedUrl;
}

/**
 * React hook: resolves a signed URL for a private-bucket file.
 */
export function useSignedFileUrl(
  bucket: string,
  urlOrPath: string | null | undefined,
  expiresInSeconds = 3600,
): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    if (!urlOrPath) {
      setUrl(null);
      return;
    }
    getSignedFileUrl(bucket, urlOrPath, expiresInSeconds).then((u) => {
      if (active) setUrl(u);
    });
    return () => {
      active = false;
    };
  }, [bucket, urlOrPath, expiresInSeconds]);
  return url;
}

/**
 * Opens a private-bucket file in a new tab by generating a fresh signed URL on click.
 */
export async function openSignedFile(
  bucket: string,
  urlOrPath: string | null | undefined,
  expiresInSeconds = 300,
): Promise<void> {
  const url = await getSignedFileUrl(bucket, urlOrPath, expiresInSeconds);
  if (url) window.open(url, "_blank", "noopener,noreferrer");
}