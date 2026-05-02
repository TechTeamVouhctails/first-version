import { RequireAuth } from "@/components/require-auth";
import { ParentNav } from "@/app/parent/parent-nav";

export default function ParentLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth role="PET_PARENT">
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
        <ParentNav />
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      </div>
    </RequireAuth>
  );
}
