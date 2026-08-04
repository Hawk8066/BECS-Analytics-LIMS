"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";

export async function authenticate(
  _prev: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const as = formData.get("as");
  // Where to land after sign-in. Only same-origin absolute paths are allowed
  // (guards against open redirects); anything else falls back to /app.
  const cb = formData.get("callbackUrl");
  const redirectTo =
    typeof cb === "string" && cb.startsWith("/") && !cb.startsWith("//")
      ? cb
      : "/app";
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      as: typeof as === "string" ? as : "",
      redirectTo,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      // A wrong entrance also fails auth; hint at it when an entrance was chosen.
      return as
        ? "Invalid credentials, or you're using the wrong sign-in entrance for this account."
        : "Invalid email or password.";
    }
    // Re-throw redirect and other control-flow errors.
    throw error;
  }
  return undefined;
}
