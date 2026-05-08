"use client";

import Script from "next/script";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch } from "@/lib/api/client";
import type { BookingState, ChatMessage, PaymentStage, Pet, ServiceType } from "@/lib/api/types";
import { requireRazorpayKey } from "@/lib/public-env";
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
  latitude: string;
  longitude: string;
  startsAt: string;
  endsAt: string;
  estimatedAmount: string;
  depositAmount: string;
  finalAmount: string;
  pet: Pet;
  owner: Party;
  provider: Party;
  transactions: Array<{
    id: string;
    stage: PaymentStage;
    status: string;
    orderId: string | null;
    amount: string;
  }>;
};

export default function ParentBookingDetailPage() {
  const { id: bookingId } = useParams<{ id: string }>();
  const { session, user } = useAuth();
  const qc = useQueryClient();
  const [otpStart, setOtpStart] = useState("");
  const [otpEnd, setOtpEnd] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [chatBody, setChatBody] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [liveLoc, setLiveLoc] = useState<{ lat: number; lon: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rzpReady, setRzpReady] = useState(false);

  const bq = useQuery({
    queryKey: ["booking", bookingId],
    enabled: !!session?.access_token && !!bookingId,
    queryFn: () => apiFetch<{ booking: BookingDetail }>(`/bookings/${bookingId}`, { accessToken: session!.access_token })
  });

  const booking = bq.data?.booking;

  const receiverId = useMemo(() => {
    if (!booking || !user) return "";
    return booking.ownerId === user.id ? booking.providerId : booking.ownerId;
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
    if (!session?.access_token || !bookingId || !user) return;
    const socket = createBookingSocket(session.access_token);
    socket.emit("booking:join", bookingId);
    socket.on("chat:new-message", (payload: ChatMessage) => {
      if (payload.bookingId === bookingId) {
        setMessages((m) => (m.some((x) => x.id === payload.id) ? m : [...m, payload]));
      }
    });
    socket.on("session:location:update", (payload: { bookingId: string; latitude: number; longitude: number }) => {
      if (payload.bookingId === bookingId) {
        setLiveLoc({ lat: payload.latitude, lon: payload.longitude });
      }
    });
    return () => {
      socket.disconnect();
    };
  }, [session?.access_token, bookingId, user]);

  const refetch = () => qc.invalidateQueries({ queryKey: ["booking", bookingId] });

  async function post(path: string, body?: object) {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/bookings/${bookingId}${path}`, {
        method: "POST",
        accessToken: session.access_token,
        ...(body ? { body: JSON.stringify(body) } : {})
      });
      await refetch();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  async function cancelBooking() {
    await post("/cancel", cancelReason ? { reason: cancelReason } : {});
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

  async function pay(stage: "DEPOSIT" | "FINAL") {
    if (!session || !booking || !rzpReady || !window.Razorpay) {
      setError("Razorpay is still loading or unavailable.");
      return;
    }
    let key: string;
    try {
      key = requireRazorpayKey();
    } catch {
      setError("Set NEXT_PUBLIC_RAZORPAY_KEY_ID in .env.local");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const idem = crypto.randomUUID();
      const co = await apiFetch<{
        order: { id: string; amount: number; currency: string };
      }>("/payments/create-order", {
        method: "POST",
        accessToken: session.access_token,
        idempotencyKey: idem,
        body: JSON.stringify({ bookingId: booking.id, stage })
      });

      const rz = new window.Razorpay!({
        key,
        amount: co.order.amount,
        currency: co.order.currency,
        order_id: co.order.id,
        name: "VouchTails",
        description: `${stage} payment`,
        handler: async (response) => {
          try {
            await apiFetch("/payments/verify-payment", {
              method: "POST",
              accessToken: session.access_token,
              body: JSON.stringify({
                bookingId: booking.id,
                orderId: response.razorpay_order_id,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
                stage
              })
            });
            await refetch();
          } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Verify failed");
          }
        }
      });
      rz.open();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setBusy(false);
    }
  }

  if (bq.isLoading || !user) return <p className="text-neutral-500">Loading…</p>;
  if (bq.isError) return <p className="text-red-600">{(bq.error as Error).message}</p>;
  if (!booking) return null;

  const isOwner = booking.ownerId === user.id;
  if (!isOwner) {
    return (
      <Card>
        <p>This booking is not yours. Open it from the provider app.</p>
        <Link href="/provider" className="text-emerald-600 underline">
          Provider dashboard
        </Link>
      </Card>
    );
  }

  const canPayDeposit =
    booking.state === "REQUESTED" || booking.state === "CONFIRMED" || booking.state === "OTP_READY";
  const canStartSession = booking.state === "OTP_READY";
  const canEndSession = booking.state === "PENDING_END_OTP";
  const canPayFinal = booking.state === "PENDING_PAYMENT";
  const canCancel =
    booking.state !== "COMPLETED" &&
    booking.state !== "PAID_OUT" &&
    booking.state !== "CANCELLED_BY_OWNER" &&
    booking.state !== "CANCELLED_BY_PROVIDER";

  return (
    <div className="space-y-6">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" onLoad={() => setRzpReady(true)} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/parent" className="text-sm text-emerald-600 hover:underline">
          ← Bookings
        </Link>
        <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium dark:bg-neutral-800">{booking.state}</span>
      </div>

      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">
        {booking.serviceType} · {booking.pet.name}
      </h1>

      <Card>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {new Date(booking.startsAt).toLocaleString()} — {new Date(booking.endsAt).toLocaleString()}
        </p>
        <p className="mt-2">{booking.address}</p>
        <p className="mt-2 text-sm">
          Est. ₹{Number(booking.estimatedAmount).toFixed(0)} · Deposit ₹{Number(booking.depositAmount).toFixed(0)} · Final ₹
          {Number(booking.finalAmount).toFixed(0)}
        </p>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          Provider: {booking.provider.name ?? booking.provider.phone ?? booking.provider.id}
        </p>
      </Card>

      {liveLoc && (booking.state === "IN_PROGRESS" || booking.state === "OTP_READY") ? (
        <Card>
          <p className="text-sm font-medium">Live location (socket)</p>
          <p className="font-mono text-sm">
            {liveLoc.lat.toFixed(5)}, {liveLoc.lon.toFixed(5)}
          </p>
        </Card>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <Card>
        <h2 className="mb-3 text-lg font-medium">Actions</h2>
        <div className="flex flex-col gap-3">
          {canPayDeposit ? (
            <Button disabled={busy} onClick={() => pay("DEPOSIT")}>
              Pay deposit (Razorpay)
            </Button>
          ) : null}
          {canStartSession ? (
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <Label htmlFor="otpS">Start OTP (from provider)</Label>
                <Input id="otpS" value={otpStart} maxLength={6} onChange={(e) => setOtpStart(e.target.value.replace(/\D/g, ""))} />
              </div>
              <Button disabled={busy || otpStart.length !== 6} onClick={() => post("/start-session", { otp: otpStart })}>
                Start session
              </Button>
            </div>
          ) : null}
          {canEndSession ? (
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <Label htmlFor="otpE">End OTP (from provider)</Label>
                <Input id="otpE" value={otpEnd} maxLength={6} onChange={(e) => setOtpEnd(e.target.value.replace(/\D/g, ""))} />
              </div>
              <Button disabled={busy || otpEnd.length !== 6} onClick={() => post("/end-session", { otp: otpEnd })}>
                End session
              </Button>
            </div>
          ) : null}
          {canPayFinal ? (
            <Button disabled={busy} onClick={() => pay("FINAL")}>
              Pay final (Razorpay)
            </Button>
          ) : null}
          {canCancel ? (
            <div className="border-t border-neutral-200 pt-3 dark:border-neutral-800">
              <Label htmlFor="why">Cancel reason (optional)</Label>
              <Textarea id="why" className="mt-1" rows={2} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
              <Button variant="danger" className="mt-2" disabled={busy} onClick={cancelBooking}>
                Cancel booking
              </Button>
            </div>
          ) : null}
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-lg font-medium">Payments</h2>
        <ul className="text-sm text-neutral-700 dark:text-neutral-300">
          {booking.transactions.length === 0 ? <li>No transactions yet.</li> : null}
          {booking.transactions.map((t) => (
            <li key={t.id}>
              {t.stage} · {t.status} · ₹{Number(t.amount).toFixed(0)}
              {t.orderId ? ` · order ${t.orderId}` : ""}
            </li>
          ))}
        </ul>
      </Card>

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
          <Input value={chatBody} placeholder="Message…" onChange={(e) => setChatBody(e.target.value)} />
          <Button disabled={busy} onClick={sendChat}>
            Send
          </Button>
        </div>
      </Card>
    </div>
  );
}
