"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";

export function ProviderNav() {
  const { signOut } = useAuth();
  const router = useRouter();

  return (
    <header className="border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-3">
        <Link href="/provider" className="font-semibold text-emerald-700 dark:text-emerald-400">
          VouchTails · Provider
        </Link>
        <nav className="flex flex-wrap items-center gap-4 text-sm">
          <Link href="/provider" className="text-neutral-700 hover:text-emerald-600 dark:text-neutral-300">
            Bookings
          </Link>
          <Link href="/provider/profile" className="text-neutral-700 hover:text-emerald-600 dark:text-neutral-300">
            Profile
          </Link>
          <Button
            variant="ghost"
            className="!p-0 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
            onClick={async () => {
              await signOut();
              router.replace("/login");
            }}
          >
            Sign out
          </Button>
        </nav>
      </div>
    </header>
  );
}
