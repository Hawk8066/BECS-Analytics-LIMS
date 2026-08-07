"use client";

import { useActionState } from "react";
import {
  createVendorPortal,
  deleteVendorPortal,
  type FormState,
} from "@/lib/actions/vendors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export function VendorPortalManager({
  vendorId,
  email,
  login,
}: {
  vendorId: string;
  email: string; // stored vendor email (seeds the create form)
  login: { email: string; status: string } | null;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    createVendorPortal,
    {},
  );

  // Freshly created — show the one-time password.
  if (state.ok && state.tempPassword) {
    return (
      <div className="space-y-3 rounded-md border border-green-200 bg-green-50 p-4">
        <p className="font-medium text-green-800">Portal login created ✓</p>
        <p className="text-sm text-green-900">
          Share these one-time credentials with the vendor — the password is shown
          only now.
        </p>
        <div className="rounded-md border bg-white p-3 font-mono text-sm">
          <div>Login URL: /vendor</div>
          <div>Email: {state.loginEmail}</div>
          <div>Temporary password: {state.tempPassword}</div>
        </div>
      </div>
    );
  }

  if (login) {
    return (
      <div className="space-y-3">
        <div className="text-sm">
          <div>
            <span className="text-muted-foreground">Login email: </span>
            <span className="font-medium">{login.email}</span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-muted-foreground">Status:</span>
            <Badge variant={login.status === "ACTIVE" ? "default" : "secondary"}>
              {login.status}
            </Badge>
          </div>
        </div>
        <form action={deleteVendorPortal}>
          <input type="hidden" name="vendorId" value={vendorId} />
          <Button type="submit" variant="outline" size="sm">
            Remove login
          </Button>
        </form>
        <p className="text-xs text-muted-foreground">
          Removing the login deletes the vendor&apos;s access to the /vendor
          portal. You can create a new one afterwards (a fresh password is
          issued).
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="max-w-md space-y-3">
      <input type="hidden" name="vendorId" value={vendorId} />
      <div className="grid gap-2">
        <Label htmlFor="portal-email">Login email</Label>
        <Input
          id="portal-email"
          name="email"
          type="email"
          defaultValue={email}
          placeholder="vendor@example.com"
          required
        />
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Creating…" : "Create portal login"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Creates a /vendor portal account so the vendor can sign in and see their
        POs and quotations. A one-time password is shown once.
      </p>
    </form>
  );
}
