"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch } from "@/lib/api/client";
import type { AppUser, Role } from "@/lib/api/types";

export default function RoleOnboardingPage() {
  const { session, user, refreshUser } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Role | null>(null);

  useEffect(() => {
    if (!session) {
      router.replace("/login");
    }
  }, [session, router]);

  useEffect(() => {
    if (user?.role) {
      router.replace(user.role === "PET_PARENT" ? "/parent" : "/provider");
    }
  }, [user, router]);

  if (!session) {
    return null;
  }

  if (user?.role) {
    return null;
  }

  async function choose(role: Role) {
    const token = session?.access_token;
    if (!token) {
      setError("Not signed in.");
      return;
    }
    setError(null);
    setBusy(role);
    try {
      const res = await apiFetch<{ user: AppUser }>("/auth/set-role", {
        method: "POST",
        accessToken: token,
        body: JSON.stringify({ role })
      });
      await refreshUser();
      router.replace(res.user.role === "PET_PARENT" ? "/parent" : "/provider");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not set role");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-12">
      <h1 className="mb-2 text-center text-2xl font-semibold text-neutral-900 dark:text-white">Choose how you use VouchTails</h1>
      <p className="mb-8 text-center text-sm text-neutral-600 dark:text-neutral-400">
        You can switch later only by contacting support; pick the primary flow for this account.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="cursor-pointer transition hover:border-emerald-500">
          <h2 className="text-lg font-medium text-neutral-900 dark:text-white">Pet parent</h2>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">Book walks, sitting, grooming, and boarding.</p>
          <Button
            className="mt-4 w-full"
            disabled={busy !== null}
            onClick={() => choose("PET_PARENT")}
          >
            {busy === "PET_PARENT" ? "Saving…" : "Continue as pet parent"}
          </Button>
        </Card>
        <Card className="cursor-pointer transition hover:border-emerald-500">
          <h2 className="text-lg font-medium text-neutral-900 dark:text-white">Provider</h2>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">Offer services and manage bookings.</p>
          <Button
            className="mt-4 w-full"
            disabled={busy !== null}
            onClick={() => choose("PROVIDER")}
          >
            {busy === "PROVIDER" ? "Saving…" : "Continue as provider"}
          </Button>
        </Card>
      </div>
      {error ? <p className="mt-4 text-center text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
