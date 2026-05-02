"use client";

/**
 * Root error UI when the root layout throws. Uses its own <html>/<body> per Next.js App Router.
 */
export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 bg-neutral-50 p-6 text-neutral-900 dark:bg-neutral-950 dark:text-white">
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="max-w-md text-center text-sm text-neutral-600 dark:text-neutral-400">{error.message}</p>
        <button
          type="button"
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          onClick={() => reset()}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
