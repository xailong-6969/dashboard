"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AddressSearch() {
  const router = useRouter();
  const [value, setValue] = useState("");

  const go = () => {
    const v = value.trim();
    if (/^0x[a-fA-F0-9]{40}$/.test(v)) router.push(`/address/${v}`);
  };

  return (
    <div className="flex gap-2 w-full max-w-xl">
      <input
        className="flex-1 rounded-md border border-neutral-800 bg-black px-3 py-2 text-sm text-white placeholder:text-neutral-500"
        placeholder="Paste wallet address (0x...)"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => (e.key === "Enter" ? go() : null)}
      />
      <button
        className="rounded-md border border-neutral-800 px-4 py-2 text-sm text-neutral-200 hover:text-white"
        onClick={go}
      >
        Search
      </button>
    </div>
  );
}
