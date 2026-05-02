"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch, ApiError } from "@/lib/api/client";
import type { ProviderProfile, ServiceType } from "@/lib/api/types";

const SERVICES: ServiceType[] = ["WALKING", "SITTING", "GROOMING", "BOARDING"];

export default function ProviderProfilePage() {
  const { session } = useAuth();
  const [bio, setBio] = useState("");
  const [baseRate, setBaseRate] = useState("400");
  const [lat, setLat] = useState("13.0827");
  const [lon, setLon] = useState("80.2707");
  const [radiusKm, setRadiusKm] = useState("10");
  const [isAvailable, setIsAvailable] = useState(true);
  const [selectedServices, setSelectedServices] = useState<ServiceType[]>(["WALKING"]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const profileQ = useQuery({
    queryKey: ["provider-profile"],
    enabled: !!session?.access_token,
    queryFn: async () => {
      try {
        return await apiFetch<{ profile: ProviderProfile }>("/providers/me", { accessToken: session!.access_token });
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) return null;
        throw e;
      }
    }
  });

  useEffect(() => {
    const p = profileQ.data?.profile;
    if (!p) return;
    setBio(p.bio ?? "");
    setBaseRate(String(Number(p.baseRate)));
    setLat(String(Number(p.latitude)));
    setLon(String(Number(p.longitude)));
    setRadiusKm(String(p.radiusKm));
    setIsAvailable(p.isAvailable);
    setSelectedServices([...p.serviceTypes]);
  }, [profileQ.data]);

  function toggleService(s: ServiceType) {
    setSelectedServices((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));
  }

  async function save() {
    if (!session) return;
    if (selectedServices.length === 0) {
      setError("Pick at least one service type.");
      return;
    }
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      if (profileQ.data?.profile) {
        await apiFetch("/providers/me", {
          method: "PATCH",
          accessToken: session.access_token,
          body: JSON.stringify({
            bio: bio || null,
            serviceTypes: selectedServices,
            baseRate: Number(baseRate),
            latitude: Number(lat),
            longitude: Number(lon),
            radiusKm: Number(radiusKm),
            isAvailable,
            city: "Chennai"
          })
        });
      } else {
        await apiFetch("/providers/me", {
          method: "POST",
          accessToken: session.access_token,
          body: JSON.stringify({
            bio: bio || undefined,
            serviceTypes: selectedServices,
            baseRate: Number(baseRate),
            latitude: Number(lat),
            longitude: Number(lon),
            radiusKm: Number(radiusKm),
            isAvailable,
            city: "Chennai"
          })
        });
      }
      setSaved(true);
      await profileQ.refetch();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  if (profileQ.isLoading) return <p className="text-neutral-500">Loading profile…</p>;
  if (profileQ.isError) return <p className="text-red-600">{(profileQ.error as Error).message}</p>;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">Service profile</h1>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        You must save a profile with Chennai coordinates to appear in nearby/match search.
      </p>
      <Card>
        <div className="space-y-4">
          <div>
            <Label>Bio</Label>
            <Textarea className="mt-1" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} />
          </div>
          <div>
            <Label>Service types</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {SERVICES.map((s) => (
                <label key={s} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedServices.includes(s)}
                    onChange={() => toggleService(s)}
                  />
                  {s}
                </label>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="br">Base rate (INR)</Label>
            <Input id="br" type="number" min={1} value={baseRate} onChange={(e) => setBaseRate(e.target.value)} />
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
            <Label htmlFor="rk">Radius (km)</Label>
            <Input id="rk" type="number" min={1} max={100} value={radiusKm} onChange={(e) => setRadiusKm(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isAvailable} onChange={(e) => setIsAvailable(e.target.checked)} />
            Available for new bookings
          </label>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {saved ? <p className="text-sm text-emerald-600">Saved.</p> : null}
          <Button disabled={busy} onClick={save}>
            {busy ? "Saving…" : "Save profile"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
