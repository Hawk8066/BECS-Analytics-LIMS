import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { verify } from "argon2";
import { prisma } from "@/lib/db";
import { authConfig } from "@/auth.config";

// Full (Node-runtime) Auth.js instance. Credentials provider verifies the
// Argon2id hash and only lets ACTIVE users in (account is created on COO
// approval — SSOT §5). Designation/facility/section ride in the JWT.
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (creds) => {
        const email = typeof creds?.email === "string" ? creds.email : null;
        const password =
          typeof creds?.password === "string" ? creds.password : null;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        // Resigned accounts are blocked; PENDING_* users may sign in but are
        // gated to onboarding by the app layout until COO approval (SSOT §5).
        if (!user || !user.passwordHash || user.status === "NON_ACTIVE")
          return null;

        const ok = await verify(user.passwordHash, password);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          designation: user.designation,
          status: user.status,
          facilityId: user.facilityId,
          sectionId: user.sectionId,
        };
      },
    }),
  ],
});
