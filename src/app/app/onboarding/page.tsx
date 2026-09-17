import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { ProfileForm } from "./profile-form";

export default async function OnboardingPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status === "ACTIVE") redirect("/app");

  // A deactivated account lands here too, because every /app page redirects
  // non-ACTIVE users to onboarding. Without this branch they would be shown the
  // "Complete your profile" form, and completeOwnProfile would move them to
  // PENDING_APPROVAL — letting a deactivated person put themselves back in the
  // COO's approval queue and quietly undo their own offboarding.
  if (user.status === "NON_ACTIVE") {
    return (
      <div className="max-w-xl space-y-2">
        <h1 className="text-2xl font-semibold">Account deactivated</h1>
        <p className="text-sm text-muted-foreground">
          This account is no longer active, so it cannot be used to sign in or
          record work. Your records are retained. If you believe this is a
          mistake, contact the COO or your lab manager.
        </p>
      </div>
    );
  }

  if (user.status === "PENDING_APPROVAL") {
    return (
      <div className="max-w-xl space-y-2">
        <h1 className="text-2xl font-semibold">Awaiting approval</h1>
        <p className="text-sm text-muted-foreground">
          Your profile has been submitted and is pending COO approval. You will
          gain full access once approved.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Complete your profile</h1>
        <p className="text-sm text-muted-foreground">
          Fill in your details and submit for COO approval to activate your
          account.
        </p>
      </div>
      <ProfileForm />
    </div>
  );
}
