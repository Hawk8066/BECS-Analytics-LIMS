import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { loadFile } from "@/lib/storage/local";

export const runtime = "nodejs";

// Auth-gated file serving for attachments (raw-data photos, etc.).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const att = await prisma.attachment.findUnique({ where: { id } });
  if (!att) return new Response("Not found", { status: 404 });

  const buf = await loadFile(att.storageKey);
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": att.contentType,
      "Content-Disposition": `inline; filename="${att.fileName}"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
