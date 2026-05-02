"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch } from "@/lib/api/client";
import type { BookingState, ChatMessage, Pet, ServiceType } from "@/lib/api/types";
import { createBookingSocket } from "@/lib/socket";

type Party = { id: string; name: string | null; phone: string | null; email?: string | null };

type BookingDetail = {
  id: string;
  state: BookingState;
  ownerId: string;
  providerId: string;
  petId: string;
  serviceType: ServiceType;
  address: string;
  depositPaidAt: string | null;
  startsAt: string;
  endsAt: string;
  estimatedAmount: string;
  depositAmount: string;
  finalAmount: string;
  pet: Pet;
  owner: Party;
  provider: Party;
};

export default function ProviderBookingDetailPage() {
  const { id: bookingId } = useParams<{ id: string }>();
  const { session, user } = useAuth();
  const qc = useQueryClient();
  const [cancelReason, setCancelReason] = useState("");
  const [chatBody, setChatBody] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [startOtp, setStartOtp] = useState<string | null>(null);
  const [endOtp, setEndOtp] = useState<string | null>(null);
  const [trackLat, setTrackLat] = useState("13.0827");
  const [trackLon, setTrackLon] = useState("80.2707");

  const bq = useQuery({
    queryKey: ["booking", bookingId],
    enabled: !!session?.access_token && !!bookingId,
    queryFn: () => apiFetch<{ booking: BookingDetail }>(`/bookings/${bookingId}`, { accessToken: session!.access_token })
  });

  const booking = bq.data?.booking;
  const bookingStateRef = useRef<BookingState | undefined>(undefined);
  bookingStateRef.current = booking?.state;

  const receiverId = useMemo(() => {
    if (!booking || !user) return "";
    return booking.providerId === user.id ? booking.ownerId : booking.providerId;
  }, [booking, user]);

  const loadMessages = useCallback(async () => {
    if (!session?.access_token || !bookingId) return;
    const res = await apiFetch<{ messages: ChatMessage[] }>(
      `/chat/messages?bookingId=${bookingId}&limit=50`,
      { accessToken: session.access_token }
    );
    setMessages([...res.messages].reverse());
  }, [session?.access_token, bookingId]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    if (!session?.access_token || !bookingId) return;
    const socket = createBookingSocket(session.access_token);
    socket.emit("booking:join", bookingId);
    socket.on("chat:new-message", (payload: ChatMessage) => {
      if (payload.bookingId === bookingId) {
        setMessages((m) => (m.some((x) => x.id === payload.id) ? m : [...m, payload]));
      }
    });
    const tick = window.setInterval(async () => {
      if (bookingStateRef.current !== "IN_PROGRESS") return;
      const la = Number(trackLat);
      const lo = Number(trackLon);
      if (!Number.isFinite(la) || !Number.isFinite(lo)) return;
      try {
        await apiFetch(`/bookings/${bookingId}/session-tracking`, {
          method: "POST",
          accessToken: session.access_token,
          body: JSON.stringify({ latitude: la, longitude: lo, speedKmph: 4 })
        });
        socket.emit("session:location", {
          bookingId,
          latitude: la,
          longitude: lo,
          speedKmph: 4
        });
      } catch {
        /* ignore transient errors */
      }
    }, 12_000);
    return () => {
      window.clearInterval(tick);
      socket.disconnect();
    };
  }, [session?.access_token, bookingId, trackLat, trackLon]);

  const refetch = () => qc.invalidateQueries({ queryKey: ["booking", bookingId] });

  async function post(path: string, body?: object) {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{ booking: BookingDetail; otp?: string }>(`/bookings/${bookingId}${path}`, {
        method: "POST",
        accessToken: session.access_token,
        ...(body ? { body: JSON.stringify(body) } : {})
      });
      if (path === "/otp/start" && res.otp) setStartOtp(res.otp);
      if (path === "/otp/end" && res.otp) setEndOtp(res.otp);
      await refetch();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  async function sendChat() {
    if (!session || !receiverId || !chatBody.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/chat/messages", {
        method: "POST",
        accessToken: session.access_token,
        body: JSON.stringify({ bookingId, receiverId, body: chatBody.trim() })
      });
      setChatBody("");
      await loadMessages();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to send");
    } finally {
      setBusy(false);
    }
  }

  async function cancelBooking() {
    await post("/cancel", cancelReason ? { reason: cancelReason } : {});
  }

  function useGps() {
    if (!navigator.geolocation) {
      setError("Geolocation not supported");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setTrackLat(String(pos.coords.latitude.toFixed(6)));
        setTrackLon(String(pos.coords.longitude.toFixed(6)));
      },
      () => setError("Could not read GPS")
    );
  }

  if (bq.isLoading || !user) return <p className="text-neutral-500">Loading…</p>;
  if (bq.isError) return <p className="text-red-600">{(bq.error as Error).message}</p>;
  if (!booking) return null;

  const isProvider = booking.providerId === user.id;
  if (!isProvider) {
    return (
      <Card>
        <p>Not your booking as provider.</p>
        <Link href="/parent" className="text-emerald-600 underline">
          Parent app
        </Link>
      </Card>
    );
  }

  const canConfirm = booking.state === "REQUESTED";
  const canStartOtp = booking.state === "CONFIRMED" && !!booking.depositPaidAt;
  const canEndOtp = booking.state === "IN_PROGRESS";
  const canCancel =
    booking.state !== "COMPLETED" &&
    booking.state !== "PAID_OUT" &&
    booking.state !== "CANCELLED_BY_OWNER" &&
    booking.state !== "CANCELLED_BY_PROVIDER";

  return (
    <div className="space-y-6">
      <Link href="/provider" className="text-sm text-emerald-600 hover:underline">
        ← Bookings
      </Link>
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">
        {booking.serviceType} · {booking.pet.name}
      </h1>
      <span className="inline-block rounded-full bg-neutral-100 px-3 py-1 text-xs dark:bg-neutral-800">{booking.state}</span>

      <Card>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {new Date(booking.startsAt).toLocaleString()} — {new Date(booking.endsAt).toLocaleString()}
        </p>
        <p className="mt-2">{booking.address}</p>
        <p className="mt-2 text-sm">
          Owner: {booking.owner.name ?? booking.owner.phone ?? booking.owner.id}
        </p>
      </Card>

      {startOtp ? (
        <Card className="border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40">
          <p className="font-medium text-amber-900 dark:text-amber-100">Start session OTP (tell pet parent)</p>
          <p className="mt-2 font-mono text-2xl tracking-widest">{startOtp}</p>
        </Card>
      ) : null}
      {endOtp ? (
        <Card className="border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40">
          <p className="font-medium text-amber-900 dark:text-amber-100">End session OTP (tell pet parent)</p>
          <p className="mt-2 font-mono text-2xl tracking-widest">{endOtp}</p>
        </Card>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <Card>
        <h2 className="mb-3 text-lg font-medium">Provider actions</h2>
        <div className="flex flex-col gap-3">
          {canConfirm ? (
            <Button disabled={busy} onClick={() => post("/confirm")}>
              Confirm booking
            </Button>
          ) : null}
          {booking.state === "CONFIRMED" && !booking.depositPaidAt ? (
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Waiting for the pet parent to pay the deposit before you can generate the start OTP.
            </p>
          ) : null}
          {canStartOtp ? (
            <Button disabled={busy} onClick={() => post("/otp/start")}>
              Generate start OTP
            </Button>
          ) : null}
          {canEndOtp ? (
            <Button disabled={busy} onClick={() => post("/otp/end")}>
              Request end OTP
            </Button>
          ) : null}
        </div>
      </Card>

      {booking.state === "IN_PROGRESS" ? (
        <Card>
          <h2 className="mb-3 text-lg font-medium">Session tracking</h2>
          <p className="mb-2 text-sm text-neutral-600 dark:text-neutral-400">
            Every ~12s the app POSTs a point and emits live location on the socket for the parent map.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Lat</Label>
              <Input value={trackLat} onChange={(e) => setTrackLat(e.target.value)} />
            </div>
            <div>
              <Label>Lon</Label>
              <Input value={trackLon} onChange={(e) => setTrackLon(e.target.value)} />
            </div>
          </div>
          <Button variant="secondary" className="mt-2" type="button" onClick={useGps}>
            Use GPS once
          </Button>
        </Card>
      ) : null}

      {canCancel ? (
        <Card>
          <h2 className="mb-2 text-lg font-medium">Cancel</h2>
          <Textarea rows={2} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Reason (optional)" />
          <Button variant="danger" className="mt-2" disabled={busy} onClick={cancelBooking}>
            Cancel booking
          </Button>
        </Card>
      ) : null}

      <Card>
        <h2 className="mb-3 text-lg font-medium">Chat</h2>
        <div className="mb-3 max-h-64 space-y-2 overflow-y-auto rounded-lg border border-neutral-200 p-2 text-sm dark:border-neutral-800">
          {messages.map((m) => (
            <div key={m.id} className={m.senderId === user.id ? "text-right" : "text-left"}>
              <span className="inline-block rounded-lg bg-neutral-100 px-2 py-1 dark:bg-neutral-900">{m.body}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Input value={chatBody} onChange={(e) => setChatBody(e.target.value)} placeholder="Message…" />
          <Button disabled={busy} onClick={sendChat}>
            Send
          </Button>
        </div>
      </Card>
    </div>
  );
}
