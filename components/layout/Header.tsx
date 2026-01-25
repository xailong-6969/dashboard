"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Home", href: "/" },
  { label: "Markets", href: "/markets" },
  { label: "Leaderboard", href: "/leaderboard" },
];

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = search.trim();
    if (trimmed && /^0x[a-fA-F0-9]{40}$/i.test(trimmed)) {
      router.push(`/address/${trimmed}`);
      setSearch("");
    } else if (trimmed.length > 0) {
      alert("Please enter a valid Ethereum address (0x...)");
    }
  };

  return (
    <header className="sticky top-0 z-50 glass border-b border-[var(--border-color)]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3 group shrink-0">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <span className="text-lg font-bold text-white">δ</span>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-base font-semibold text-white leading-tight">Delphi Analytics</h1>
              <p className="text-[10px] font-medium text-cyan-400 uppercase tracking-wider">Gensyn Testnet</p>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                  pathname === item.href
                    ? "bg-white/10 text-white"
                    : "text-zinc-400 hover:text-white hover:bg-white/5"
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <form onSubmit={handleSearch} className="flex-1 max-w-md">
            <div className={cn(
              "relative flex items-center transition-all duration-200",
              isSearchFocused && "transform scale-[1.02]"
            )}>
              <input
                type="text"
                placeholder="Search wallet (0x...)"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setIsSearchFocused(false)}
                className={cn(
                  "w-full px-4 py-2.5 pr-12 rounded-lg bg-[var(--bg-secondary)] border text-white placeholder-zinc-500 text-sm font-mono",
                  "focus:outline-none transition-all duration-200",
                  isSearchFocused 
                    ? "border-blue-500/50 ring-1 ring-blue-500/20" 
                    : "border-[var(--border-color)]"
                )}
              />
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md bg-blue-600 hover:bg-blue-500 transition-colors"
              >
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            </div>
          </form>

          
            href="https://delphi.gensyn.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden lg:flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-zinc-400 hover:text-white hover:bg-white/5 transition-all"
          >
            <span>Trade</span>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      </div>
    </header>
  );
}
