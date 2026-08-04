import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { verify } from "argon2";
import { prisma } from "@/lib/db";
import { authConfig } from "@/auth.config";
import { writeAudit } from "@/lib/audit/audit-log";
import { entranceOf } from "@/lib/auth/entrance";

// Full (Node-runtime) Auth.js instance. Credentials provider verifies the
// Argon2id hash and only lets ACTIVE users in (account is created on COO
// approval — SSOT §5). Designation/facility/section ride in the JWT.
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  session: { strategy: "jwt" },
  // Record every successful sign-in in the immutable audit log (BR-5). The
  // app-level audit trail thus covers authentication as well as data changes.
  events: {
    async signIn({ user }) {
      if (!user?.id) return;
      try {
        await writeAudit({
          actorId: user.id,
          action: "LOGIN",
          entityType: "User",
          entityId: user.id,
        });
      } catch {
        // Never let audit-logging failure block authentication.
      }
    },
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        as: { label: "Entrance", type: "text" },
      },
      authorize: async (creds) => {
        const email = typeof creds?.email === "string" ? creds.email : null;
        const password =
          typeof creds?.password === "string" ? creds.password : null;
        const as = typeof creds?.as === "string" ? creds.as : null;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({
          where: { email },
          include: { section: true },
        });
        // Resigned accounts are blocked; PENDING_* users may sign in but are
        // gated to onboarding by the app layout until COO approval (SSOT §5).
        if (!user || !user.passwordHash || user.status === "NON_ACTIVE")
          return null;

        const ok = await verify(user.passwordHash, password);
        if (!ok) return null;

        // Enforce the chosen sign-in entrance (landing-page button), if given.
        if (as && entranceOf(user.designation, user.section?.type) !== as)
          return null;

        return {
          id: user.id,
          email: user.email,
          designation: user.designation,
          status: user.status,
          facilityId: user.facilityId,
          sectionId: user.sectionId,
          clientId: user.clientId,
          vendorId: user.vendorId,
          outsourceLabId: user.outsourceLabId,
        };
      },
    }),
  ],
});
