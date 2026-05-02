"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch } from "@/lib/api/client";
import type { BookingListItem } from "@/lib/api/types";

export default function ProviderDashboardPage() {
  const { session } = useAuth();
  const q = useQuery({
    queryKey: ["bookings", "provider"],
    enabled: !!session?.access_token,
    queryFn: () =>
      apiFetch<{ bookings: BookingListItem[] }>("/bookings?as=provider&scope=all&limit=30", {
        accessToken: session!.access_token
      })
  });

  if (q.isLoading) return <p className="text-neutral-500">Loading…</p>;
  if (q.isError) return <p className="text-red-600">{(q.error as Error).message}</p>;

  const rows = q.data?.bookings ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">Your bookings</h1>
        <Link href="/provider/profile">
          <Button variant="secondary">Profile & availability</Button>
        </Link>
      </div>
      {rows.length === 0 ? (
        <Card>
          <p className="text-neutral-600 dark:text-neutral-400">
            No bookings yet. Complete your service profile to appear in search.
          </p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {rows.map((b) => (
            <li key={b.id}>
              <Link href={`/provider/bookings/${b.id}`}>
                <Card className="transition hover:border-emerald-400">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-neutral-900 dark:text-white">
                        {b.serviceType} · {b.pet.name}
                      </p>
                      <p className="text-sm text-neutral-600 dark:text-neutral-400">
                        {new Date(b.startsAt).toLocaleString()} — {b.owner.name ?? b.owner.phone ?? "Owner"}
                      </p>
                    </div>
                    <span className="rounded-full bg-neutral-100 px-2 py-1 text-xs dark:bg-neutral-800">{b.state}</span>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
