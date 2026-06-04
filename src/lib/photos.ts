import { supabase } from "@/integrations/supabase/client";

const BUCKET = "vehicle-photos";
// Default to a long-lived signed URL so reports stay viewable across sessions.
// 30 days. The Report page refreshes these on every load anyway.
const DEFAULT_EXPIRY_SECONDS = 60 * 60 * 24 * 30;

/**
 * Extracts the storage object path (e.g. "<userId>/<uuid>.jpg") from either:
 *  - a bare storage path (returned as-is)
 *  - a legacy public URL (".../object/public/vehicle-photos/<path>")
 *  - a previously-signed URL (".../object/sign/vehicle-photos/<path>?token=...")
 * Returns null if the value doesn't reference the vehicle-photos bucket.
 */
export function extractPhotoPath(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = String(value).trim();
  if (!v) return null;
  if (!v.startsWith("http")) return v.replace(/^\/+/, "");
  try {
    const u = new URL(v);
    const marker = `/${BUCKET}/`;
    const idx = u.pathname.indexOf(marker);
    if (idx === -1) return null;
    return decodeURIComponent(u.pathname.slice(idx + marker.length));
  } catch {
    return null;
  }
}

/**
 * Batch-signs a list of photo references and returns aligned signed URLs.
 * Items that fail to sign come back as empty strings so caller indexes stay stable.
 */
export async function signPhotoUrls(
  values: (string | null | undefined)[],
  expiresIn: number = DEFAULT_EXPIRY_SECONDS,
): Promise<string[]> {
  if (!values || values.length === 0) return [];
  const paths = values.map(extractPhotoPath);
  const unique = Array.from(new Set(paths.filter((p): p is string => !!p)));
  if (unique.length === 0) return values.map(() => "");

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(unique, expiresIn);
  if (error || !data) return values.map(() => "");

  const map = new Map<string, string>();
  for (const item of data) {
    if (item.path && item.signedUrl) map.set(item.path, item.signedUrl);
  }
  return paths.map((p) => (p ? map.get(p) ?? "" : ""));
}
