import Link from "next/link";

export default function Page() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="space-y-3">
        <h2 className="text-2xl font-semibold tracking-tight text-white">
          Delphi Testnet Analytics
        </h2>
        <p className="text-sm text-neutral-400">
          Use the address search in the header to view wallet history and stats.
        </p>
        <div className="pt-2">
          <Link
            href="/market/active"
            className="text-sm text-neutral-300 hover:text-white underline-offset-4 hover:underline"
          >
            View active market →
          </Link>
        </div>
      </div>
    </main>
  );
}
