import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { sha256Of, storageKeyFor } from "./shared";

// Supabase Storage driver — the cloud counterpart to ./local, used because a
// Render container's filesystem is ephemeral and anything written to disk is lost
// on restart or redeploy.
//
// This talks to a PRIVATE bucket using the service-role key, which bypasses all
// row-level security. `server-only` turns any accidental client-side import into a
// build error rather than a leaked secret. Files stay auth-gated behind
// /api/files/[id]; we deliberately do not hand out public or signed URLs.

let cached: SupabaseClient | null = null;

function client(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey)
    throw new Error(
      "STORAGE_DRIVER=supabase requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  // No session to persist: this is a stateless server-side client.
  cached = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

function bucket(): string {
  return process.env.SUPABASE_STORAGE_BUCKET ?? "becs-lims";
}

export async function saveFile(
  buffer: Buffer,
  opts: { dir: string; fileName: string },
): Promise<{ storageKey: string; sha256: string }> {
  const sha256 = sha256Of(buffer);
  const storageKey = storageKeyFor(opts);

  // `upsert: false` makes a key collision an error instead of silently destroying
  // an existing attachment. Content type is recorded on the Attachment row and
  // served from there (src/app/api/files/[id]/route.ts), so the object's own type
  // is only ever cosmetic in the Supabase dashboard.
  const { error } = await client()
    .storage.from(bucket())
    .upload(storageKey, buffer, {
      upsert: false,
      // Explicit, because supabase-js defaults an ArrayBufferView to
      // "text/plain;charset=utf-8" — never let a charset near binary bytes.
      contentType: "application/octet-stream",
    });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  return { storageKey, sha256 };
}

export async function loadFile(storageKey: string): Promise<Buffer> {
  const { data, error } = await client()
    .storage.from(bucket())
    .download(storageKey);
  if (error || !data)
    throw new Error(
      `Storage download failed for ${storageKey}: ${error?.message ?? "no data"}`,
    );
  return Buffer.from(await data.arrayBuffer());
}
