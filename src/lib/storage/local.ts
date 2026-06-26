import { writeFile, mkdir, readFile as fsReadFile } from "fs/promises";
import path from "path";
import { createHash } from "crypto";

// Local-filesystem object storage for dev (gitignored ./storage). Swappable for
// S3/MinIO later behind the same Attachment model (SSOT §14).
const ROOT = path.join(process.cwd(), "storage");

export async function saveFile(
  buffer: Buffer,
  opts: { dir: string; fileName: string },
): Promise<{ storageKey: string; sha256: string }> {
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  const safe = opts.fileName.replace(/[^\w.\-]+/g, "_");
  const key = `${opts.dir}/${Date.now()}-${safe}`;
  const abs = path.join(ROOT, key);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, buffer);
  return { storageKey: key, sha256 };
}

export async function loadFile(storageKey: string): Promise<Buffer> {
  const abs = path.resolve(ROOT, storageKey);
  if (!abs.startsWith(ROOT)) throw new Error("Invalid storage key");
  return fsReadFile(abs);
}
