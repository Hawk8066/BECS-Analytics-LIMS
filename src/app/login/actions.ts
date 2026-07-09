"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";

export async function authenticate(
  _prev: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const as = formData.get("as");
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      as: typeof as === "string" ? as : "",
      redirectTo: "/app",
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
