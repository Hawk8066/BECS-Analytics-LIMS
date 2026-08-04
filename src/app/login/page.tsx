"use client";

import { Suspense, useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { authenticate } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { BecsLogo } from "@/components/becs-logo";

const PORTAL_LABELS: Record<string, string> = {
  "lahore-lab": "Lahore Lab",
  "ryk-lab": "RYK Lab",
  client: "Client",
  vendor: "Vendor",
  outsource: "Outsource Lab",
  management: "Management",
};

function LoginInner() {
  const [error, formAction, pending] = useActionState(authenticate, undefined);
  const params = useSearchParams();
  const as = params.get("as") ?? "";
  const callbackUrl = params.get("callbackUrl") ?? "";
  // The BTF QC portal signs in via callbackUrl (no entrance), so title from it.
  const label =
    callbackUrl === "/btf-qc" ? "BTF Quality Control" : PORTAL_LABELS[as];
  const isPortal =
    as === "client" ||
    as === "vendor" ||
    as === "outsource" ||
    callbackUrl === "/btf-qc";

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <BecsLogo size={44} className="mb-1" />
        <CardDescription>
          {isPortal
            ? `${label} Portal — sign in to continue`
            : label
              ? `${label} — sign in to continue`
              : "Laboratory Management System — sign in to continue"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-4">
          <input type="hidden" name="as" value={as} />
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@becs.test"
              autoComplete="username"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Signing in…" : "Sign in"}
          </Button>
          <Link
            href="/"
            className="text-center text-sm text-muted-foreground hover:text-foreground hover:underline"
          >
            ← Back
          </Link>
        </form>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <Suspense>
        <LoginInner />
      </Suspense>
    </main>
  );
}
