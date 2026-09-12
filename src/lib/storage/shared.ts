import { createHash } from "crypto";

// Contract shared by every object-storage driver (SSOT §14). `Attachment.storageKey`
// stores whatever `saveFile` returns and hands it straight back to `loadFile`, so
// the key is opaque to the rest of the app — only the driver that wrote it needs to
// understand it.
export interface StorageDriver {
  saveFile(
    buffer: Buffer,
    opts: { dir: string; fileName: string },
  ): Promise<{ storageKey: string; sha256: string }>;
  loadFile(storageKey: string): Promise<Buffer>;
}

/**
 * Key layout is deliberately identical across drivers: a `dir/timestamp-filename`
 * path that is valid both as a POSIX path and as a Supabase Storage object name.
 * Keeping it stable is what lets files copied between drivers stay readable
 * without rewriting existing Attachment rows.
 */
export function storageKeyFor(opts: { dir: string; fileName: string }): string {
  const safe = opts.fileName.replace(/[^\w.\-]+/g, "_");
  return `${opts.dir}/${Date.now()}-${safe}`;
}

export function sha256Of(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}
