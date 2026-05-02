"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch } from "@/lib/api/client";
import type { NearbyProvider, Pet, ServiceType } from "@/lib/api/types";

const CHENNAI = { lat: 13.0827, lon: 80.2707 };

export default function DiscoverPage() {
  const { session } = useAuth();
  const router = useRouter();
  const [serviceType, setServiceType] = useState<ServiceType>("WALKING");
  const [lat, setLat] = useState(String(CHENNAI.lat));
  const [lon, setLon] = useState(String(CHENNAI.lon));
  const [startsLocal, setStartsLocal] = useState("");
  const [endsLocal, setEndsLocal] = useState("");
  const [selectedProvider, setSelectedProvider] = useState<NearbyProvider | null>(null);
  const [petId, setPetId] = useState("");
  const [address, setAddress] = useState("");
  const [estimatedAmount, setEstimatedAmount] = useState("500");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const petsQ = useQuery({
    queryKey: ["pets"],
    enabled: !!session?.access_token,
    queryFn: () => apiFetch<{ pets: Pet[] }>("/pets", { accessToken: session!.access_token })
  });

  const matchParams = useMemo(() => {
    if (!startsLocal || !endsLocal) return null;
    const startsAt = new Date(startsLocal).toISOString();
    const endsAt = new Date(endsLocal).toISOString();
    if (new Date(endsAt) <= new Date(startsAt)) return null;
    const la = Number(lat);
    const lo = Number(lon);
    if (!Number.isFinite(la) || !Number.isFinite(lo)) return null;
    return { startsAt, endsAt, la, lo };
  }, [startsLocal, endsLocal, lat, lon]);

  const matchQ = useQuery({
    queryKey: ["providers", "match", serviceType, matchParams?.startsAt, matchParams?.endsAt, lat, lon],
    enabled: !!session?.access_token && !!matchParams,
    queryFn: () =>
      apiFetch<{ providers: NearbyProvider[] }>(
        `/providers/match?lat=${matchParams!.la}&lon=${matchParams!.lo}&serviceType=${serviceType}&startsAt=${encodeURIComponent(matchParams!.startsAt)}&endsAt=${encodeURIComponent(matchParams!.endsAt)}`,
        { accessToken: session!.access_token }
      )
  });

  async function createBooking() {
    if (!session || !selectedProvider || !petId || !matchParams || !address.trim()) {
      setError("Select provider, pet, window, and enter a full address.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{ booking: { id: string } }>("/bookings", {
        method: "POST",
        accessToken: session.access_token,
        body: JSON.stringify({
          providerId: selectedProvider.userId,
          petId,
          serviceType,
          address: address.trim(),
          latitude: matchParams.la,
          longitude: matchParams.lo,
          startsAt: matchParams.startsAt,
          endsAt: matchParams.endsAt,
          estimatedAmount: Number(estimatedAmount)
        })
      });
      router.push(`/parent/bookings/${res.booking.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Booking failed");
    } finally {
      setBusy(false);
    }
  }

  const providers = matchQ.data?.providers ?? [];

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">Discover & book</h1>

      <Card>
        <h2 className="mb-4 text-lg font-medium text-neutral-900 dark:text-white">Search</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Service</Label>
            <select
              className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-950"
              value={serviceType}
              onChange={(e) => setServiceType(e.target.value as ServiceType)}
            >
              {(["WALKING", "SITTING", "GROOMING", "BOARDING"] as const).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="lat">Latitude</Label>
              <Input id="lat" value={lat} onChange={(e) => setLat(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="lon">Longitude</Label>
              <Input id="lon" value={lon} onChange={(e) => setLon(e.target.value)} />
            </div>
          </div>
          <div>
            <Label htmlFor="start">Starts</Label>
            <Input id="start" type="datetime-local" value={startsLocal} onChange={(e) => setStartsLocal(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="end">Ends</Label>
            <Input id="end" type="datetime-local" value={endsLocal} onChange={(e) => setEndsLocal(e.target.value)} />
          </div>
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          Chennai area: lat ~13.0, lon ~80.2. Match requires a valid time range.
        </p>
        {matchQ.isError ? <p className="mt-2 text-sm text-red-600">{(matchQ.error as Error).message}</p> : null}
      </Card>

      {matchParams ? (
        <div>
          <h2 className="mb-3 text-lg font-medium text-neutral-900 dark:text-white">Matched providers</h2>
          {matchQ.isLoading ? (
            <p className="text-neutral-500">Loading…</p>
          ) : providers.length === 0 ? (
            <Card>
              <p className="text-neutral-600 dark:text-neutral-400">No providers in range. Adjust location or service.</p>
            </Card>
          ) : (
            <ul className="space-y-2">
              {providers.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className={`w-full rounded-xl border p-4 text-left transition ${
                      selectedProvider?.id === p.id
                        ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                        : "border-neutral-200 bg-white hover:border-emerald-300 dark:border-neutral-800 dark:bg-neutral-950"
                    }`}
                    onClick={() => setSelectedProvider(p)}
                  >
                    <span className="font-medium">Provider</span>{" "}
                    <span className="text-neutral-500">· {p.distance_km.toFixed(1)} km</span>
                    {typeof p.score === "number" ? (
                      <span className="ml-2 text-sm text-neutral-500">score {p.score.toFixed(1)}</span>
                    ) : null}
                    <p className="text-sm text-neutral-600 dark:text-neutral-400">
                      ₹{Number(p.baseRate).toFixed(0)} base · {p.completedJobs} jobs · ★{Number(p.rating).toFixed(1)}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      <Card>
        <h2 className="mb-4 text-lg font-medium text-neutral-900 dark:text-white">Booking details</h2>
        <div className="space-y-4">
          <div>
            <Label>Pet</Label>
            <select
              className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-950"
              value={petId}
              onChange={(e) => setPetId(e.target.value)}
            >
              <option value="">Select pet</option>
              {(petsQ.data?.pets ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.species})
                </option>
              ))}
            </select>
            {petsQ.data?.pets.length === 0 ? (
              <p className="mt-1 text-xs text-amber-700">
                <a href="/parent/pets/new" className="underline">
                  Add a pet first
                </a>
              </p>
            ) : null}
          </div>
          <div>
            <Label htmlFor="addr">Address (min 10 chars)</Label>
            <Input id="addr" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Full service address" />
          </div>
          <div>
            <Label htmlFor="amt">Estimated amount (INR)</Label>
            <Input id="amt" type="number" min={1} value={estimatedAmount} onChange={(e) => setEstimatedAmount(e.target.value)} />
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Button disabled={busy || !selectedProvider} onClick={createBooking}>
            {busy ? "Creating…" : "Request booking"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
