import { RequireAuth } from "@/components/require-auth";
import { ProviderNav } from "@/app/provider/provider-nav";

export default function ProviderLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth role="PROVIDER">
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
        <ProviderNav />
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      </div>
    </RequireAuth>
  );
}
