import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { verify } from "argon2";
import { prisma } from "@/lib/db";
import { grantsCrossSectionRead } from "@/lib/auth/session";

// Auth.js (NextAuth v5) — Credentials provider with JWT sessions.
// Only ACTIVE users with a password hash can sign in (SSOT §5: account is
// created on COO approval). Designation/facility/section are carried in the JWT
// so the two-tier authorization + scoping layers can read them without a DB hit.
export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
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
        if (!user || !user.passwordHash || user.status !== "ACTIVE") return null;

        const ok = await verify(user.passwordHash, password);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          designation: user.designation,
          facilityId: user.facilityId,
          sectionId: user.sectionId,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        // `user` is the object returned from authorize() on sign-in.
        const u = user as unknown as {
          id: string;
          designation: string;
          facilityId: string;
          sectionId: string;
        };
        token.uid = u.id;
        token.designation = u.designation;
        token.facilityId = u.facilityId;
        token.sectionId = u.sectionId;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        const designation = token.designation as
          | Parameters<typeof grantsCrossSectionRead>[0]
          | undefined;
        Object.assign(session.user, {
          id: token.uid,
          designation,
          facilityId: token.facilityId,
          sectionId: token.sectionId,
          canReadCrossSection: designation
            ? grantsCrossSectionRead(designation)
            : false,
        });
      }
      return session;
    },
  },
});
