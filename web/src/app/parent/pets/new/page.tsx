"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch } from "@/lib/api/client";
import type { Pet } from "@/lib/api/types";

export default function NewPetPage() {
  const { session } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [species, setSpecies] = useState("");
  const [breed, setBreed] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return;
    setError(null);
    setBusy(true);
    try {
      const res = await apiFetch<{ pet: Pet }>("/pets", {
        method: "POST",
        accessToken: session.access_token,
        body: JSON.stringify({
          name,
          species,
          ...(breed ? { breed } : {}),
          ...(notes ? { notes } : {})
        })
      });
      router.replace(`/parent/pets/${res.pet.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create pet");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">Add pet</h1>
      <Card>
        <form className="space-y-4" onSubmit={submit}>
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="species">Species</Label>
            <Input id="species" required placeholder="Dog, Cat…" value={species} onChange={(e) => setSpecies(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="breed">Breed (optional)</Label>
            <Input id="breed" value={breed} onChange={(e) => setBreed(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea id="notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
