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
      router.push("/address/" + trimmed);
      setSearch("");
    } else if (trimmed.length > 0) {
      alert("Please enter a valid Ethereum address (0x...)");
    }
  };

  return (
    <header className="sticky top-0 z-50 glass border-b border-[var(--border-color)]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group shrink-0">
            <img
              src="/bat-logo.png"
              alt="Logo"
              className="w-9 h-9 rounded-lg object-contain"
            />
            <div className="hidden sm:block">
              <h1 className="text-base font-semibold text-white leading-tight">Delphi Analytics</h1>
              <p className="text-[10px] font-medium text-cyan-400 uppercase tracking-wider">Gensyn Testnet</p>
            </div>
          </Link>

          {/* Navigation */}
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

          {/* Search */}
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
                  "w-full px-4 py-2.5 pr-12 rounded-lg bg-[var(--bg-secondary)] border text-white placeholder-zinc-500 text-sm font-mono focus:outline-none transition-all duration-200",
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

          {/* Right side - Trade link + Creator */}
          <div className="hidden lg:flex items-center gap-4">
            {/* Trade Link */}
            <a
              href="https://delphi.gensyn.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-zinc-400 hover:text-white hover:bg-white/5 transition-all"
            >
              <span>Trade</span>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>

            {/* Divider */}
            <div className="w-px h-6 bg-zinc-700"></div>

            {/* Creator with GitHub */}
            <div className="flex flex-col items-end">
              <span className="text-xs text-zinc-500">
                Built by <span className="text-purple-400 font-medium">xailong_6969</span>
              </span>
              <a
                href="https://github.com/xailong-6969/Delphi-Analytics"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-zinc-500 hover:text-white transition-colors mt-0.5"
              >
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
                </svg>
                GitHub
              </a>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
