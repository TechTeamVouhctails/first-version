"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import type { Role } from "@/lib/api/types";

export function RequireAuth({
  children,
  role
}: {
  children: React.ReactNode;
  role?: Role;
}) {
  const { session, user, loading } = useAuth();
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
    if (role && user.role !== role) {
      router.replace(user.role === "PET_PARENT" ? "/parent" : "/provider");
    }
  }, [loading, session, user, role, router]);

  if (loading || !session || !user?.role || (role && user.role !== role)) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-neutral-500 dark:text-neutral-400">
        Loading…
      </div>
    );
  }

  return <>{children}</>;
}
