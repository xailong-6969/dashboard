"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { formatNumber, formatTokens, formatAddress, formatTimeAgo } from "@/lib/utils";
import StatCard from "@/components/ui/StatCard";
import { MARKETS } from "@/lib/markets-config";
import CountdownTimer from "@/components/CountdownTimer";
import { Card3D, FloatingCard, StaggerContainer, StaggerItem } from "@/components/ui/Card3D";
import { ScrollSection, ScrollContainer, SectionDots } from "@/components/ScrollSection";
import MobileNav from "@/components/MobileNav";

// Lazy load ParticleBackground for faster initial page load
const ParticleBackground = dynamic(
  () => import("@/components/ParticleBackground"),
  { ssr: false, loading: () => null }
);

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

const sections = [
  { id: "hero", label: "Home" },
  { id: "stats", label: "Statistics" },
  { id: "markets", label: "Markets" },
  { id: "trades", label: "Recent Trades" },
];

export default function HomePage() {
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState("hero");
  const containerRef = useRef<HTMLDivElement>(null);

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
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Track active section on scroll using scroll position
  useEffect(() => {
    const handleScroll = () => {
      const scrollContainer = document.querySelector('[data-scroll-container]') as HTMLElement;
      if (!scrollContainer) return;

      const scrollTop = scrollContainer.scrollTop;
      const containerHeight = scrollContainer.clientHeight;

      // Find which section is currently most visible
      let currentSection = "hero";

      sections.forEach(({ id }) => {
        const el = document.getElementById(id);
        if (el) {
          const rect = el.getBoundingClientRect();
          const containerRect = scrollContainer.getBoundingClientRect();
          const relativeTop = rect.top - containerRect.top;

          // If section is in the top half of the viewport, it's the active one
          if (relativeTop <= containerHeight / 2 && relativeTop > -rect.height / 2) {
            currentSection = id;
          }
        }
      });

      setActiveSection(currentSection);
    };

    // Wait for DOM to be ready
    const timer = setTimeout(() => {
      const scrollContainer = document.querySelector('[data-scroll-container]');
      if (scrollContainer) {
        scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
        handleScroll(); // Initial check
      }
    }, 200);

    return () => {
      clearTimeout(timer);
      const scrollContainer = document.querySelector('[data-scroll-container]');
      if (scrollContainer) {
        scrollContainer.removeEventListener('scroll', handleScroll);
      }
    };
  }, []);

  const getDisplayMarketId = (internalId: string): string => {
    const config = MARKETS[internalId];
    return config?.displayId || internalId;
  };

  if (loading || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <ParticleBackground />
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center z-10"
        >
          <div className="w-16 h-16 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-400">Loading Delphi Analytics...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <>
      <ParticleBackground />
      <MobileNav />
      <SectionDots sections={sections} activeSection={activeSection} />

      <ScrollContainer>
        {/* HERO SECTION */}
        <ScrollSection id="hero" className="px-4">
          <div className="mx-auto max-w-5xl text-center">
            <motion.div
              initial={{ opacity: 0, y: -30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <h1 className="text-5xl sm:text-7xl font-bold mb-6">
                <span className="gradient-text">Delphi</span>
                <br />
                <span className="text-white">Analytics</span>
              </h1>
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="text-xl text-zinc-400 max-w-2xl mx-auto mb-12"
            >
              Track prediction markets, analyze trading patterns, and monitor P&L
              for Delphi on Gensyn Testnet.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="flex flex-wrap justify-center gap-4"
            >
              <Link
                href="/markets"
                className="px-8 py-4 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold transition-all hover:scale-105"
              >
                Explore Markets
              </Link>
              <Link
                href="/leaderboard"
                className="px-8 py-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-semibold transition-all hover:scale-105 border border-zinc-700"
              >
                View Leaderboard
              </Link>
            </motion.div>

            {/* Scroll indicator */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              className="absolute bottom-8 left-1/2 -translate-x-1/2"
            >
              <motion.div
                animate={{ y: [0, 10, 0] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="flex flex-col items-center text-zinc-500"
              >
                <span className="text-sm mb-2">Scroll to explore</span>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </motion.div>
            </motion.div>
          </div>
        </ScrollSection>

        {/* STATS SECTION */}
        <ScrollSection id="stats" className="px-4 py-20">
          <div className="mx-auto max-w-6xl">
            <motion.h2
              className="text-3xl font-bold text-center text-white mb-12"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
            >
              Platform Statistics
            </motion.h2>

            <StaggerContainer>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
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

            {/* Quick Stats Bar */}
            <motion.div
              className="mt-12 p-6 rounded-2xl bg-zinc-800/50 backdrop-blur-sm border border-zinc-700/50"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <div className="flex flex-wrap justify-center gap-8 text-center">
                <div>
                  <p className="text-3xl font-bold text-white">{formatNumber(data.totalTrades, 0)}</p>
                  <p className="text-sm text-zinc-500">Total Trades</p>
                </div>
                <div className="w-px bg-zinc-700 hidden sm:block" />
                <div>
                  <p className="text-3xl font-bold text-white">{formatNumber(data.uniqueTraders, 0)}</p>
                  <p className="text-sm text-zinc-500">Unique Traders</p>
                </div>
                <div className="w-px bg-zinc-700 hidden sm:block" />
                <div>
                  <p className="text-3xl font-bold text-violet-400">{data.activeMarkets + data.settledMarkets}</p>
                  <p className="text-sm text-zinc-500">Total Markets</p>
                </div>
              </div>
            </motion.div>
          </div>
        </ScrollSection>

        {/* MARKETS SECTION */}
        <ScrollSection id="markets" className="px-4 py-20">
          <div className="mx-auto max-w-6xl">
            <motion.div
              className="text-center mb-12"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl font-bold text-white mb-4">Markets</h2>
              <p className="text-zinc-400 mb-4">Explore prediction markets on Gensyn Testnet</p>

              {/* Market 3 Countdown Timer */}
              {MARKETS["3"]?.endTimestamp && MARKETS["3"]?.status === "active" && (
                <div className="inline-block bg-zinc-800/50 backdrop-blur-sm border border-zinc-700/50 rounded-xl px-6 py-3">
                  <CountdownTimer
                    endTimestamp={MARKETS["3"].endTimestamp}
                    label="Market 3 ends in"
                  />
                </div>
              )}
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <FloatingCard delay={0.1}>
                <Link href="/markets" className="card p-8 card-hover group block text-center">
                  <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center text-4xl mx-auto mb-4 group-hover:scale-110 transition-transform">
                    📊
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2 group-hover:text-blue-400 transition-colors">
                    All Markets
                  </h3>
                  <p className="text-sm text-zinc-500">
                    View active and settled prediction markets
                  </p>
                </Link>
              </FloatingCard>

              <FloatingCard delay={0.2}>
                <Link href="/leaderboard" className="card p-8 card-hover group block text-center">
                  <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center text-4xl mx-auto mb-4 group-hover:scale-110 transition-transform">
                    🏆
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2 group-hover:text-amber-400 transition-colors">
                    Leaderboard
                  </h3>
                  <p className="text-sm text-zinc-500">
                    Top traders ranked by P&L
                  </p>
                </Link>
              </FloatingCard>

              <FloatingCard delay={0.3}>
                <a
                  href="https://delphi.gensyn.ai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="card p-8 card-hover group block text-center"
                >
                  <div className="w-16 h-16 rounded-2xl bg-purple-500/10 flex items-center justify-center text-4xl mx-auto mb-4 group-hover:scale-110 transition-transform">
                    🎯
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2 group-hover:text-purple-400 transition-colors">
                    Trade Now
                  </h3>
                  <p className="text-sm text-zinc-500">
                    Buy and sell shares on Delphi
                  </p>
                </a>
              </FloatingCard>
            </div>
          </div>
        </ScrollSection>

        {/* RECENT TRADES SECTION */}
        {data.recentTrades && data.recentTrades.length > 0 && (
          <ScrollSection id="trades" className="px-4 py-20" fullHeight={false}>
            <div className="mx-auto max-w-6xl">
              <motion.div
                className="text-center mb-8"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
              >
                <h2 className="text-3xl font-bold text-white mb-2">Recent Trades</h2>
                <div className="flex items-center justify-center gap-2 text-sm text-zinc-500">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Live</span>
                </div>
              </motion.div>

              <motion.div
                className="card overflow-hidden"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
              >
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[400px] sm:min-w-0">
                    <thead>
                      <tr className="text-left text-xs text-zinc-500 border-b border-[var(--border-color)]">
                        <th className="px-3 sm:px-4 py-3 font-medium">Type</th>
                        <th className="px-3 sm:px-4 py-3 font-medium">Trader</th>
                        <th className="px-3 sm:px-4 py-3 font-medium">Market</th>
                        <th className="px-3 sm:px-4 py-3 font-medium text-right">Amount</th>
                        <th className="px-3 sm:px-4 py-3 font-medium text-right hidden sm:table-cell">Price</th>
                        <th className="px-3 sm:px-4 py-3 font-medium text-right hidden md:table-cell">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentTrades.slice(0, 8).map((trade: HomeData['recentTrades'][0], idx: number) => {
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
                            <td className="px-3 sm:px-4 py-3">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${trade.isBuy
                                  ? "bg-emerald-500/10 text-emerald-400"
                                  : "bg-red-500/10 text-red-400"
                                  }`}
                              >
                                {trade.isBuy ? "BUY" : "SELL"}
                              </span>
                            </td>
                            <td className="px-3 sm:px-4 py-3">
                              <Link
                                href={`/address/${trade.trader}`}
                                className="font-mono text-xs sm:text-sm text-zinc-300 hover:text-blue-400 transition-colors"
                              >
                                {formatAddress(trade.trader, 4)}
                              </Link>
                            </td>
                            <td className="px-3 sm:px-4 py-3">
                              <Link
                                href={`/markets/${internalId}`}
                                className="text-xs sm:text-sm text-zinc-300 hover:text-blue-400 whitespace-nowrap"
                              >
                                Market #{displayId}
                              </Link>
                            </td>
                            <td className="px-3 sm:px-4 py-3 text-right">
                              <span className="font-mono text-xs sm:text-sm text-white">
                                {formatTokens(trade.tokensDelta)}
                              </span>
                            </td>
                            <td className="px-3 sm:px-4 py-3 text-right hidden sm:table-cell">
                              <span className="font-mono text-sm text-zinc-400">
                                {trade.impliedProbability?.toFixed(1) || "0"}%
                              </span>
                            </td>
                            <td className="px-3 sm:px-4 py-3 text-right hidden md:table-cell">
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
              </motion.div>

              {/* Indexer Status */}
              <motion.div
                className="mt-8 text-center"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
              >
                <p className="text-xs text-zinc-600">
                  Last indexed block: <span className="font-mono text-zinc-500">{data.lastIndexedBlock}</span>
                  {data.lastIndexedAt && (
                    <span className="ml-2">• Updated {formatTimeAgo(data.lastIndexedAt)}</span>
                  )}
                </p>
              </motion.div>
            </div>
          </ScrollSection>
        )}

        {/* FOOTER */}
        <section className="px-4 py-12 border-t border-zinc-800/50">
          <div className="mx-auto max-w-6xl text-center">
            <p className="text-zinc-600 text-sm">
              Built with &hearts; for the{" "}
              <a href="https://gensyn.ai" target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:underline">
                Gensyn
              </a>{" "}
              community
            </p>
          </div>
        </section>
      </ScrollContainer>
    </>
  );
}
