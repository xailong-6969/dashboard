"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AddressSearch() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  const go = () => {
    const v = value.trim();
    if (!v) {
      setError("Please enter an address");
      return;
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(v)) {
      setError("Invalid address format");
      return;
    }
    setError("");
    router.push(`/address/${v}`);
  };

  return (
    <div className="w-full">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2.5 text-sm text-white placeholder:text-neutral-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
            placeholder="Search by Address (0x...)"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError("");
            }}
            onKeyDown={(e) => (e.key === "Enter" ? go() : null)}
          />
          {error && (
            <p className="absolute left-0 top-full mt-1 text-xs text-red-400">
              {error}
            </p>
          )}
        </div>
        <button
          className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-black"
          onClick={go}
        >
          Search
        </button>
      </div>
    </div>
  );
}
