import "server-only";
import { prisma } from "@/lib/db";

// The undertaking is due on first sign-in and again each calendar year (1 Jan),
// i.e. whenever there's no signature for the current year.
export function undertakingYear(): number {
  return new Date().getFullYear();
}

export async function isUndertakingDue(userId: string): Promise<boolean> {
  const year = undertakingYear();
  const signed = await prisma.impartialityUndertaking.findUnique({
    where: { userId_year: { userId, year } },
  });
  return !signed;
}
