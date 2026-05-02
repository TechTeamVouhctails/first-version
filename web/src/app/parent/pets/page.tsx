"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch } from "@/lib/api/client";
import type { Pet } from "@/lib/api/types";

export default function PetsListPage() {
  const { session } = useAuth();
  const q = useQuery({
    queryKey: ["pets"],
    enabled: !!session?.access_token,
    queryFn: () => apiFetch<{ pets: Pet[] }>("/pets", { accessToken: session!.access_token })
  });

  if (q.isLoading) return <p className="text-neutral-500">Loading pets…</p>;
  if (q.isError) return <p className="text-red-600">{(q.error as Error).message}</p>;

  const pets = q.data?.pets ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">Pets</h1>
        <Link href="/parent/pets/new">
          <Button>Add pet</Button>
        </Link>
      </div>
      {pets.length === 0 ? (
        <Card>
          <p className="text-neutral-600 dark:text-neutral-400">No pets yet. Add one to make a booking.</p>
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {pets.map((p) => (
            <li key={p.id}>
              <Link href={`/parent/pets/${p.id}`}>
                <Card className="h-full transition hover:border-emerald-400">
                  <p className="font-medium text-neutral-900 dark:text-white">{p.name}</p>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    {p.species}
                    {p.breed ? ` · ${p.breed}` : ""}
                  </p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
