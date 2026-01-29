"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { formatNumber, formatTokens, formatAddress, formatTimeAgo } from "@/lib/utils";
import StatCard from "@/components/ui/StatCard";
import { MARKETS } from "@/lib/markets-config";
import { Card3D, FloatingCard, SlideIn, StaggerContainer, StaggerItem } from "@/components/ui/Card3D";

interface HomeData {
  totalTrades: number;
  activeMarkets: number;
  settledMarkets: number;
  totalVolume: string;
  volume24h: string;
  trades24h: number;
  uniqueTraders: number;
  lastIndexedBlock: string;
  lastIndexedAt: string | null;
  recentTrades: Array<{
    id: string;
    trader: string;
    isBuy: boolean;
    tokensDelta: string;
    blockTime: string;
    marketId: string;
    modelIdx: string;
    impliedProbability: number;
  }>;
}

export default function HomePage() {
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/stats");
        const json = await res.json();
        setData(json);
      } catch (e) {
        console.error("Failed to fetch stats:", e);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  if (loading || !data) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:py-12">
        <div className="animate-pulse space-y-8">
          <div className="h-32 bg-zinc-800 rounded-xl"></div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-zinc-800 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const getDisplayMarketId = (internalId: string): string => {
    const config = MARKETS[internalId];
    return config?.displayId || internalId;
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:py-12">
      {/* Hero Section with 3D effect */}
      <motion.div 
        className="text-center mb-12"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
      >
        <motion.h1 
          className="text-4xl sm:text-5xl font-bold mb-4"
          initial={{ y: -50 }}
          animate={{ y: 0 }}
          transition={{ type: "spring", stiffness: 100 }}
        >
          <span className="gradient-text">Delphi Analytics</span>
        </motion.h1>
        <motion.p 
          className="text-lg text-zinc-400 max-w-2xl mx-auto"
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          Track prediction markets, analyze trading patterns, and monitor P&L
          for Delphi on Gensyn Testnet.
        </motion.p>
      </motion.div>

      {/* Main Stats Grid with 3D cards */}
      <StaggerContainer>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StaggerItem>
            <Card3D>
              <StatCard
                title="24H Volume"
                value={formatNumber(Number(data.volume24h) / 1e18)}
                subtitle={`${data.trades24h.toLocaleString()} trades`}
                color="green"
              />
            </Card3D>
          </StaggerItem>
          
          <StaggerItem>
            <Card3D>
              <StatCard
                title="Active Markets"
                value={data.activeMarkets}
                subtitle={`${data.settledMarkets} settled`}
                color="blue"
              />
            </Card3D>
          </StaggerItem>
          
          <StaggerItem>
            <Card3D>
              <StatCard
                title="Unique Traders"
                value={formatNumber(data.uniqueTraders, 0)}
                subtitle={`${formatNumber(data.totalTrades, 0)} total trades`}
                color="purple"
              />
            </Card3D>
          </StaggerItem>
          
          <StaggerItem>
            <Card3D>
              <StatCard
                title="Total Volume"
                value={formatNumber(Number(data.totalVolume) / 1e18)}
                subtitle="$TEST all-time"
                color="cyan"
              />
            </Card3D>
          </StaggerItem>
        </div>
      </StaggerContainer>

      {/* Quick Links with floating effect */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        <FloatingCard delay={0.1}>
          <Link href="/markets" className="card p-6 card-hover group block">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                📊
              </div>
              <div>
                <h3 className="font-semibold text-white group-hover:text-blue-400 transition-colors">
                  Markets
                </h3>
                <p className="text-sm text-zinc-500">View all prediction markets</p>
              </div>
            </div>
          </Link>
        </FloatingCard>

        <FloatingCard delay={0.2}>
          <Link href="/leaderboard" className="card p-6 card-hover group block">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                🏆
              </div>
              <div>
                <h3 className="font-semibold text-white group-hover:text-amber-400 transition-colors">
                  Leaderboard
                </h3>
                <p className="text-sm text-zinc-500">Top traders by P&L</p>
              </div>
            </div>
          </Link>
        </FloatingCard>

        <FloatingCard delay={0.3}>
          <a
            href="https://delphi.gensyn.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="card p-6 card-hover group block"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                🎯
              </div>
              <div>
                <h3 className="font-semibold text-white group-hover:text-purple-400 transition-colors">
                  Trade Now
                </h3>
                <p className="text-sm text-zinc-500">Buy shares on Delphi</p>
              </div>
            </div>
          </a>
        </FloatingCard>
      </div>

      {/* Recent Trades with slide-in effect */}
      {data.recentTrades.length > 0 && (
        <SlideIn direction="up" delay={0.4}>
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-[var(--border-color)] flex items-center justify-between">
              <h2 className="font-semibold text-white">Recent Trades</h2>
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <span className="w-2 h-2 rounded-full bg-emerald-500 pulse-live"></span>
                <span>Live</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs text-zinc-500 border-b border-[var(--border-color)]">
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Trader</th>
                    <th className="px-4 py-3 font-medium">Market</th>
                    <th className="px-4 py-3 font-medium text-right">Amount</th>
                    <th className="px-4 py-3 font-medium text-right">Price</th>
                    <th className="px-4 py-3 font-medium text-right">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentTrades.map((trade, idx) => {
                    const internalId = trade.marketId.toString();
                    const displayId = getDisplayMarketId(internalId);
                    return (
                      <motion.tr
                        key={trade.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="table-row border-b border-[var(--border-color)] last:border-0"
                      >
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              trade.isBuy
                                ? "bg-emerald-500/10 text-emerald-400"
                                : "bg-red-500/10 text-red-400"
                            }`}
                          >
                            {trade.isBuy ? "BUY" : "SELL"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/address/${trade.trader}`}
                            className="font-mono text-sm text-zinc-300 hover:text-blue-400 transition-colors"
                          >
                            {formatAddress(trade.trader, 4)}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/markets/${internalId}`}
                            className="text-sm text-zinc-300 hover:text-blue-400"
                          >
                            Market #{displayId}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-mono text-sm text-white">
                            {formatTokens(trade.tokensDelta)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-mono text-sm text-zinc-400">
                            {trade.impliedProbability?.toFixed(1) || "0"}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-xs text-zinc-500">
                            {formatTimeAgo(trade.blockTime)}
                          </span>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </SlideIn>
      )}

      {/* Indexer Status */}
      <motion.div 
        className="mt-6 text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
      >
        <p className="text-xs text-zinc-600">
          Last indexed block: <span className="font-mono text-zinc-500">{data.lastIndexedBlock}</span>
          {data.lastIndexedAt && (
            <span className="ml-2">• Updated {formatTimeAgo(data.lastIndexedAt)}</span>
          )}
        </p>
      </motion.div>
    </div>
  );
}
