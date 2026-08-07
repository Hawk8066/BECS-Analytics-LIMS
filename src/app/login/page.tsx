import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { homePathFor } from "@/lib/auth/entrance";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  // A live session must sign out before using a different entrance — otherwise
  // the old session silently carries the user into its own portal, which reads
  // as "the wrong entrance let me in".
  const user = await getSessionUser();
  if (user) redirect(homePathFor(user.designation));

  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <LoginForm />
    </main>
  );
}
