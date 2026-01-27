"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { formatTokens, formatAddress } from "@/lib/utils";

interface Trader {
  rank: number;
  address: string;
  realizedPnl: string;
  totalVolume: string;
  totalTrades: number;
}

interface LeaderboardData {
  leaderboard: Trader[];
  totalTraders: number;
  totalPages: number;
  currentPage: number;
  error?: string;
}

export default function LeaderboardPage() {
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(50);
  const [sortBy, setSortBy] = useState<"pnl" | "volume" | "trades">("pnl");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/leaderboard?page=${page}&limit=${perPage}&sortBy=${sortBy}`;
      if (search) url += `&search=${search}`;
      
      const res = await fetch(url);
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error("Failed to fetch leaderboard:", e);
      setData({
        leaderboard: [],
        totalTraders: 0,
        totalPages: 0,
        currentPage: 1,
        error: "Failed to load",
      });
    } finally {
      setLoading(false);
    }
  }, [page, perPage, sortBy, search]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const clearSearch = () => {
    setSearchInput("");
    setSearch("");
    setPage(1);
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return `#${rank}`;
  };

  const getRankColor = (rank: number) => {
    if (rank === 1) return "text-yellow-400";
    if (rank === 2) return "text-zinc-300";
    if (rank === 3) return "text-amber-600";
    return "text-zinc-500";
  };

  const totalTraders = data?.totalTraders || 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          🏆 Leaderboard
        </h1>
        <p className="text-zinc-400 mt-1">
          {totalTraders > 0 ? `${totalTraders.toLocaleString()} traders ranked by realized P&L` : "Loading traders..."}
        </p>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search by wallet address (0x...)"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="flex-1 px-4 py-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-white placeholder-zinc-500 font-mono text-sm focus:outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            className="px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
          >
            Search
          </button>
          {search && (
            <button
              type="button"
              onClick={clearSearch}
              className="px-4 py-3 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </form>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <span className="text-sm text-zinc-400">Sort by:</span>
          <div className="flex rounded-lg overflow-hidden border border-[var(--border-color)]">
            {(["pnl", "volume", "trades"] as const).map((s) => (
              <button
                key={s}
                onClick={() => { setSortBy(s); setPage(1); }}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  sortBy === s
                    ? "bg-blue-600 text-white"
                    : "bg-[var(--bg-secondary)] text-zinc-400 hover:text-white"
                }`}
              >
                {s === "pnl" ? "P&L" : s === "volume" ? "Volume" : "Trades"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-zinc-400">Per page:</span>
          <select
            value={perPage}
            onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
            className="px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-white text-sm"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
            <p className="text-zinc-400 mt-4">Loading...</p>
          </div>
        ) : data?.error ? (
          <div className="p-12 text-center">
            <p className="text-red-400">{data.error}</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs text-zinc-500 border-b border-[var(--border-color)]">
                    <th className="px-4 py-3 font-medium w-16">Rank</th>
                    <th className="px-4 py-3 font-medium">Trader</th>
                    <th className="px-4 py-3 font-medium text-right">Realized P&L</th>
                    <th className="px-4 py-3 font-medium text-right">Volume</th>
                    <th className="px-4 py-3 font-medium text-right">Trades</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.leaderboard?.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                        {search ? "No traders found matching that address" : "No traders found"}
                      </td>
                    </tr>
                  ) : (
                    data?.leaderboard?.map((trader) => {
                      const pnl = BigInt(trader.realizedPnl);
                      const isProfitable = pnl > 0n;
                      const isLoss = pnl < 0n;

                      return (
                        <tr
                          key={trader.address}
                          className="table-row border-b border-[var(--border-color)] last:border-0 hover:bg-white/5"
                        >
                          <td className="px-4 py-3">
                            <span className={`font-semibold ${getRankColor(trader.rank)}`}>
                              {getRankBadge(trader.rank)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <Link
                              href={`/address/${trader.address}`}
                              className="font-mono text-sm text-zinc-300 hover:text-blue-400 transition-colors"
                            >
                              {formatAddress(trader.address, 6)}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span
                              className={`font-mono text-sm font-medium ${
                                isProfitable
                                  ? "text-emerald-400"
                                  : isLoss
                                  ? "text-red-400"
                                  : "text-zinc-400"
                              }`}
                            >
                              {isProfitable ? "+" : ""}
                              {formatTokens(trader.realizedPnl)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="font-mono text-sm text-zinc-300">
                              {formatTokens(trader.totalVolume)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-sm text-zinc-400">
                              {trader.totalTrades.toLocaleString()}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {data && data.totalPages > 1 && !search && (
              <div className="p-4 border-t border-[var(--border-color)] flex flex-wrap items-center justify-between gap-4">
                <p className="text-sm text-zinc-400">
                  Showing {((page - 1) * perPage) + 1}-{Math.min(page * perPage, totalTraders)} of {totalTraders.toLocaleString()} traders
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(1)}
                    disabled={page === 1}
                    className="px-3 py-1.5 rounded bg-[var(--bg-secondary)] text-sm text-zinc-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    First
                  </button>
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 rounded bg-[var(--bg-secondary)] text-sm text-zinc-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    ←
                  </button>
                  <span className="px-3 py-1.5 text-sm text-white">
                    Page {page} of {data.totalPages}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
                    disabled={page === data.totalPages}
                    className="px-3 py-1.5 rounded bg-[var(--bg-secondary)] text-sm text-zinc-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    →
                  </button>
                  <button
                    onClick={() => setPage(data.totalPages)}
                    disabled={page === data.totalPages}
                    className="px-3 py-1.5 rounded bg-[var(--bg-secondary)] text-sm text-zinc-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Last
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
