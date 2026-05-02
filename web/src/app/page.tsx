"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";

export default function HomePage() {
  const { user, loading, session } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace("/login");
      return;
    }
    if (!user?.role) {
      router.replace("/onboarding/role");
      return;
    }
    router.replace(user.role === "PET_PARENT" ? "/parent" : "/provider");
  }, [loading, session, user, router]);

  return (
    <div className="flex min-h-screen items-center justify-center text-neutral-500 dark:text-neutral-400">
      Loading…
    </div>
  );
}
