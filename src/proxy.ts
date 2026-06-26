import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Next.js 16 "proxy" convention (formerly middleware). Edge-safe instance gates
// /app/** via the authorized() callback in auth.config.ts.
const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  matcher: ["/app/:path*"],
};
