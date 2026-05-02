"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch } from "@/lib/api/client";
import type { Pet } from "@/lib/api/types";

export default function EditPetPage() {
  const { id } = useParams<{ id: string }>();
  const { session } = useAuth();
  const router = useRouter();
  const q = useQuery({
    queryKey: ["pet", id],
    enabled: !!session?.access_token && !!id,
    queryFn: () => apiFetch<{ pet: Pet }>(`/pets/${id}`, { accessToken: session!.access_token })
  });

  const [name, setName] = useState("");
  const [species, setSpecies] = useState("");
  const [breed, setBreed] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (q.data?.pet) {
      const p = q.data.pet;
      setName(p.name);
      setSpecies(p.species);
      setBreed(p.breed ?? "");
      setNotes(p.notes ?? "");
    }
  }, [q.data]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch<{ pet: Pet }>(`/pets/${id}`, {
        method: "PATCH",
        accessToken: session.access_token,
        body: JSON.stringify({
          name,
          species,
          breed: breed || undefined,
          notes: notes || undefined
        })
      });
      await q.refetch();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!session || !confirm("Delete this pet?")) return;
    setBusy(true);
    try {
      await apiFetch(`/pets/${id}`, { method: "DELETE", accessToken: session.access_token });
      router.replace("/parent/pets");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  if (q.isLoading) return <p className="text-neutral-500">Loading…</p>;
  if (q.isError) return <p className="text-red-600">{(q.error as Error).message}</p>;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">Edit pet</h1>
      <Card>
        <form className="space-y-4" onSubmit={save}>
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="species">Species</Label>
            <Input id="species" required value={species} onChange={(e) => setSpecies(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="breed">Breed</Label>
            <Input id="breed" value={breed} onChange={(e) => setBreed(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save changes"}
            </Button>
            <Button type="button" variant="danger" disabled={busy} onClick={remove}>
              Delete
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
