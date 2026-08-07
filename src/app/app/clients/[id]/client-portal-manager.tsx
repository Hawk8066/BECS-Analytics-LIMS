"use client";

import { useActionState } from "react";
import {
  createClientPortal,
  deleteClientPortal,
  type FormState,
} from "@/lib/actions/clients";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export function ClientPortalManager({
  clientId,
  email,
  login,
}: {
  clientId: string;
  email: string; // stored client email (seeds the create form)
  login: { email: string; status: string } | null;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    createClientPortal,
    {},
  );

  if (state.ok && state.tempPassword) {
    return (
      <div className="space-y-3 rounded-md border border-green-200 bg-green-50 p-4">
        <p className="font-medium text-green-800">Portal login created ✓</p>
        <p className="text-sm text-green-900">
          Share these one-time credentials with the client — the password is shown
          only now.
        </p>
        <div className="rounded-md border bg-white p-3 font-mono text-sm">
          <div>Login URL: /portal</div>
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
        <form action={deleteClientPortal}>
          <input type="hidden" name="clientId" value={clientId} />
          <Button type="submit" variant="outline" size="sm">
            Remove login
          </Button>
        </form>
        <p className="text-xs text-muted-foreground">
          Removing the login deletes the client&apos;s access to the /portal
          portal. You can create a new one afterwards (a fresh password is
          issued).
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="max-w-md space-y-3">
      <input type="hidden" name="clientId" value={clientId} />
      <div className="grid gap-2">
        <Label htmlFor="portal-email">Login email</Label>
        <Input
          id="portal-email"
          name="email"
          type="email"
          defaultValue={email}
          placeholder="client@example.com"
          required
        />
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Creating…" : "Create portal login"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Creates a /portal account so the client can sign in and see their samples
        and reports. A one-time password is shown once.
      </p>
    </form>
  );
}
