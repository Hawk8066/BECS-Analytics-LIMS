"use server";

import { signOut } from "@/auth";

// Sign out from the public landing page and return to it, so the user can pick a
// different entrance. (The in-app sign-out lands on /login instead.)
export async function signOutToLanding() {
  await signOut({ redirectTo: "/" });
}
