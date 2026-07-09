import type { NextAuthConfig } from "next-auth";
import { grantsCrossSectionRead } from "@/lib/auth/session";
import type { Designation, UserStatus } from "@prisma/client";

// Edge-safe Auth.js config (no DB / no native modules) shared by middleware and
// the full server instance. The Credentials provider (which uses Prisma + argon2)
// is added only in the Node-runtime instance (src/auth.ts).
export const authConfig = {
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    // Route protection: staff use /app, external clients use /portal.
    authorized({ auth, request: { nextUrl } }) {
      const user = auth?.user as { designation?: Designation } | undefined;
      const path = nextUrl.pathname;
      const d = user?.designation;
      const home =
        d === "CLIENT" ? "/portal" : d === "VENDOR" ? "/vendor" : "/app";

      if (path.startsWith("/app")) {
        if (!user) return false; // -> login
        if (home !== "/app") return Response.redirect(new URL(home, nextUrl));
        return true;
      }
      if (path.startsWith("/portal")) {
        if (!user) return false;
        if (home !== "/portal") return Response.redirect(new URL(home, nextUrl));
        return true;
      }
      if (path.startsWith("/vendor")) {
        if (!user) return false;
        if (home !== "/vendor") return Response.redirect(new URL(home, nextUrl));
        return true;
      }
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        const u = user as unknown as {
          id: string;
          designation: Designation;
          status: UserStatus;
          facilityId: string;
          sectionId: string;
          clientId: string | null;
          vendorId: string | null;
        };
        token.uid = u.id;
        token.designation = u.designation;
        token.status = u.status;
        token.facilityId = u.facilityId;
        token.sectionId = u.sectionId;
        token.clientId = u.clientId ?? null;
        token.vendorId = u.vendorId ?? null;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        const designation = token.designation as Designation | undefined;
        Object.assign(session.user, {
          id: token.uid,
          designation,
          status: token.status,
          facilityId: token.facilityId,
          sectionId: token.sectionId,
          clientId: token.clientId ?? null,
          vendorId: token.vendorId ?? null,
          roleKeys: [],
          canReadCrossSection: designation
            ? grantsCrossSectionRead(designation)
            : false,
        });
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
