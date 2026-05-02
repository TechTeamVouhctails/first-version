"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch, ApiError } from "@/lib/api/client";
import type { AppUser } from "@/lib/api/types";
import { publicEnv } from "@/lib/public-env";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser-client";

function toIndianE164(digits10: string) {
  const d = digits10.replace(/\D/g, "").slice(-10);
  if (d.length !== 10) return null;
  return `+91${d}`;
}

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phoneDigits, setPhoneDigits] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function sendOtp() {
    setError(null);
    const phone = toIndianE164(phoneDigits);
    if (!phone) {
      setError("Enter a valid 10-digit Indian mobile number.");
      return;
    }
    setBusy(true);
    try {
      await apiFetch<{ success: boolean }>("/auth/send-otp", {
        method: "POST",
        body: JSON.stringify({ phone })
      });
      setStep("otp");
    } catch (e: unknown) {
      if (e instanceof ApiError && e.details && typeof e.details === "object" && e.details !== null) {
        const fix = "fix" in e.details ? (e.details as { fix?: unknown }).fix : undefined;
        if (Array.isArray(fix)) {
          setError([e.message, "", ...fix.map((line: string) => `• ${line}`)].join("\n"));
          return;
        }
      }
      setError(e instanceof Error ? e.message : "Failed to send OTP");
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp() {
    setError(null);
    const phone = toIndianE164(phoneDigits);
    if (!phone || otp.length !== 6) {
      setError("Enter the 6-digit code.");
      return;
    }
    setBusy(true);
    try {
      const res = await apiFetch<{ accessToken: string; refreshToken: string; user: AppUser }>("/auth/verify-otp", {
        method: "POST",
        body: JSON.stringify({ phone, token: otp })
      });
      const supabase = createSupabaseBrowserClient();
      const { error: se } = await supabase.auth.setSession({
        access_token: res.accessToken,
        refresh_token: res.refreshToken
      });
      if (se) {
        setError(se.message);
        return;
      }
      if (!res.user.role) {
        router.replace("/onboarding/role");
      } else {
        router.replace(res.user.role === "PET_PARENT" ? "/parent" : "/provider");
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <h1 className="mb-2 text-center text-2xl font-semibold text-neutral-900 dark:text-white">VouchTails</h1>
      <p className="mb-8 text-center text-sm text-neutral-600 dark:text-neutral-400">
        Sign in with your phone ({publicEnv.apiUrl})
      </p>
      <Card>
        {step === "phone" ? (
          <div className="space-y-4">
            <div>
              <Label htmlFor="phone">Mobile (10 digits)</Label>
              <div className="mt-1 flex gap-2">
                <span className="flex items-center rounded-lg border border-neutral-300 bg-neutral-50 px-2 text-sm dark:border-neutral-600 dark:bg-neutral-900">
                  +91
                </span>
                <Input
                  id="phone"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  placeholder="9876543210"
                  value={phoneDigits}
                  onChange={(e) => setPhoneDigits(e.target.value)}
                />
              </div>
            </div>
            {error ? <p className="whitespace-pre-wrap text-sm text-red-600">{error}</p> : null}
            <Button className="w-full" disabled={busy} onClick={sendOtp}>
              {busy ? "Sending…" : "Send OTP"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-neutral-600 dark:text-neutral-400">Enter the SMS code for +91{phoneDigits.slice(-10)}</p>
            <div>
              <Label htmlFor="otp">OTP</Label>
              <Input
                id="otp"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              />
            </div>
            {error ? <p className="whitespace-pre-wrap text-sm text-red-600">{error}</p> : null}
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" disabled={busy} onClick={() => setStep("phone")}>
                Back
              </Button>
              <Button className="flex-1" disabled={busy} onClick={verifyOtp}>
                {busy ? "Verifying…" : "Verify"}
              </Button>
            </div>
          </div>
        )}
      </Card>
      <p className="mt-6 text-center text-xs text-neutral-500">
        API base: <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-800">{publicEnv.apiUrl}</code>
      </p>
      <p className="mt-2 text-center text-sm">
        <Link href="/" className="text-emerald-600 hover:underline">
          Home
        </Link>
      </p>
    </div>
  );
}
