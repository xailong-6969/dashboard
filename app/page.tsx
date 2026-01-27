import Link from "next/link";
import prisma from "@/lib/prisma";
import { formatNumber, formatTokens, formatAddress, formatTimeAgo } from "@/lib/utils";
import StatCard from "@/components/ui/StatCard";
import { VALID_MARKET_IDS_BIGINT, MARKETS } from "@/lib/markets-config";

export const dynamic = "force-dynamic";

async function getHomeData() {
  try {
    // Get markets - ONLY valid markets (0, 1, 3)
    const markets = await prisma.market.findMany({
      where: { marketId: { in: VALID_MARKET_IDS_BIGINT } },
      select: { marketId: true, status: true },
    });

    // Count using our config (more reliable)
    const activeMarkets = Object.values(MARKETS).filter(m => m.status === "active").length;
    const settledMarkets = Object.values(MARKETS).filter(m => m.status === "settled").length;

    // Get all trades for valid markets only
    const allTrades = await prisma.trade.findMany({
      where: { marketId: { in: VALID_MARKET_IDS_BIGINT } },
      select: {
        tokensDelta: true,
        blockTime: true,
        trader: true,
      },
    });

    let totalVolume = 0n;
    const uniqueTraders = new Set<string>();
    for (const t of allTrades) {
      const tokens = BigInt(t.tokensDelta);
      totalVolume += tokens < 0n ? -tokens : tokens;
      uniqueTraders.add(t.trader);
    }

    // 24h stats
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    let volume24h = 0n;
    let trades24h = 0;
    for (const t of allTrades) {
      if (t.blockTime && t.blockTime >= oneDayAgo) {
        const tokens = BigInt(t.tokensDelta);
        volume24h += tokens < 0n ? -tokens : tokens;
        trades24h++;
      }
    }

    // Get recent trades (valid markets only)
    const recentTrades = await prisma.trade.findMany({
      where: { marketId: { in: VALID_MARKET_IDS_BIGINT } },
      take: 10,
      orderBy: { blockTime: "desc" },
      select: {
        id: true,
        trader: true,
        isBuy: true,
        tokensDelta: true,
        blockTime: true,
        marketId: true,
        modelIdx: true,
        impliedProbability: true,
      },
    });

    // Get indexer state
    const indexerState = await prisma.indexerState.findUnique({
      where: { id: "delphi" },
    });

    return {
      totalTrades: allTrades.length,
      activeMarkets,
      settledMarkets,
      totalVolume: totalVolume.toString(),
      volume24h: volume24h.toString(),
      trades24h,
      uniqueTraders: uniqueTraders.size,
      lastIndexedBlock: indexerState?.lastBlock?.toString() || "0",
      lastIndexedAt: indexerState?.updatedAt,
      recentTrades,
    };
  } catch (e) {
    console.error("Home data fetch error:", e);
    return {
      totalTrades: 0,
      activeMarkets: 1,
      settledMarkets: 2,
      totalVolume: "0",
      volume24h: "0",
      trades24h: 0,
      uniqueTraders: 0,
      lastIndexedBlock: "0",
      lastIndexedAt: null,
      recentTrades: [],
    };
  }
}

// Convert internal market ID to display ID
function getDisplayMarketId(internalId: string): string {
  const config = MARKETS[internalId];
  return config?.displayId || internalId;
}

export default async function HomePage() {
  const data = await getHomeData();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:py-12">
      {/* Hero Section */}
      <div className="text-center mb-12">
        <h1 className="text-4xl sm:text-5xl font-bold mb-4">
          <span className="gradient-text">Delphi Analytics</span>
        </h1>
        <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
          Track prediction markets, analyze trading patterns, and monitor P&L
          for Delphi on Gensyn Testnet.
        </p>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="24H Volume"
          value={formatNumber(Number(data.volume24h) / 1e18)}
          subtitle={`${data.trades24h.toLocaleString()} trades`}
          color="green"
        />
        <StatCard
          title="Active Markets"
          value={data.activeMarkets}
          subtitle={`${data.settledMarkets} settled`}
          color="blue"
        />
        <StatCard
          title="Unique Traders"
          value={formatNumber(data.uniqueTraders, 0)}
          subtitle={`${formatNumber(data.totalTrades, 0)} total trades`}
          color="purple"
        />
        <StatCard
          title="Total Volume"
          value={formatNumber(Number(data.totalVolume) / 1e18)}
          subtitle="$TEST all-time"
          color="cyan"
        />
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        <Link href="/markets" className="card p-6 card-hover group">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-2xl">
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

        <Link href="/leaderboard" className="card p-6 card-hover group">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-2xl">
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

        <a
          href="https://delphi.gensyn.ai"
          target="_blank"
          rel="noopener noreferrer"
          className="card p-6 card-hover group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-2xl">
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
      </div>

      {/* Recent Trades */}
      {data.recentTrades.length > 0 && (
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
                {data.recentTrades.map((trade: any) => {
                  const internalId = trade.marketId.toString();
                  const displayId = getDisplayMarketId(internalId);
                  return (
                    <tr key={trade.id} className="table-row border-b border-[var(--border-color)] last:border-0">
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          trade.isBuy
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-red-500/10 text-red-400"
                        }`}>
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
                        <Link href={`/markets/${internalId}`} className="text-sm text-zinc-300 hover:text-blue-400">
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
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Indexer Status */}
      <div className="mt-6 text-center">
        <p className="text-xs text-zinc-600">
          Last indexed block: <span className="font-mono text-zinc-500">{data.lastIndexedBlock}</span>
          {data.lastIndexedAt && (
            <span className="ml-2">• Updated {formatTimeAgo(data.lastIndexedAt)}</span>
          )}
        </p>
      </div>
    </div>
  );
}
