import { writeFile, mkdir, readFile as fsReadFile } from "fs/promises";
import path from "path";
import { sha256Of, storageKeyFor } from "./shared";

// Local-filesystem object storage for dev (gitignored ./storage). This is the
// default driver so `npm run dev` needs no cloud account; it is NOT usable in the
// cloud, where the container filesystem is ephemeral (see ./supabase).
const ROOT = path.join(process.cwd(), "storage");

export async function saveFile(
  buffer: Buffer,
  opts: { dir: string; fileName: string },
): Promise<{ storageKey: string; sha256: string }> {
  const sha256 = sha256Of(buffer);
  const key = storageKeyFor(opts);
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
