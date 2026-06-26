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
    // Route protection for middleware: /app/** requires a session.
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnApp = nextUrl.pathname.startsWith("/app");
      if (isOnApp) return isLoggedIn;
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
        };
        token.uid = u.id;
        token.designation = u.designation;
        token.status = u.status;
        token.facilityId = u.facilityId;
        token.sectionId = u.sectionId;
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
