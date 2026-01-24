import Link from "next/link";
import prisma from "@/lib/prisma";
import { formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface RecentTrade {
  id: string;
  trader: string;
  isBuy: boolean;
  tokensDelta: string;
  blockTime: Date;
  marketId: bigint;
}

interface StatsData {
  totalTrades: number;
  totalMarkets: number;
  recentTrades: RecentTrade[];
}

async function getStats(): Promise<StatsData> {
  try {
    const [totalTrades, totalMarkets, recentTrades] = await Promise.all([
      prisma.trade.count(),
      prisma.market.count(),
      prisma.trade.findMany({
        take: 5,
        orderBy: { blockTime: "desc" },
        select: {
          id: true,
          trader: true,
          isBuy: true,
          tokensDelta: true,
          blockTime: true,
          marketId: true,
        },
      }),
    ]);
    return { totalTrades, totalMarkets, recentTrades };
  } catch (e) {
    return { totalTrades: 0, totalMarkets: 0, recentTrades: [] };
  }
}

export default async function HomePage() {
  const { totalTrades, totalMarkets, recentTrades } = await getStats();

  return (
    <div className="mx-auto max-w-7xl px-4 py-16">
      {/* Hero */}
      <div className="text-center mb-16">
        <h1 className="text-5xl md:text-7xl font-bold mb-6">
          <span className="gradient-text text-glow">Delphi Analytics</span>
        </h1>
        <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-8">
          Track wallet activity, analyze trading patterns, and view profit & loss 
          for Delphi prediction markets on Gensyn Testnet.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
        <div className="glass rounded-2xl p-6 card-hover">
          <div className="text-sm text-slate-400 uppercase tracking-wider mb-2">Total Trades</div>
          <div className="text-4xl font-bold text-white">{formatNumber(totalTrades, 0)}</div>
        </div>
        <div className="glass rounded-2xl p-6 card-hover">
          <div className="text-sm text-slate-400 uppercase tracking-wider mb-2">Active Markets</div>
          <div className="text-4xl font-bold text-white">{formatNumber(totalMarkets, 0)}</div>
        </div>
        <div className="glass rounded-2xl p-6 card-hover">
          <div className="text-sm text-slate-400 uppercase tracking-wider mb-2">Network</div>
          <div className="text-4xl font-bold text-cyan-400">Gensyn</div>
        </div>
      </div>

      {/* Features */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
        <Link href="/markets" className="glass rounded-2xl p-8 card-hover group">
          <div className="text-4xl mb-4">📊</div>
          <h3 className="text-xl font-bold text-white mb-2 group-hover:text-purple-400 transition-colors">Markets</h3>
          <p className="text-slate-400">View all active prediction markets with real-time pricing.</p>
        </Link>

        <Link href="/leaderboard" className="glass rounded-2xl p-8 card-hover group">
          <div className="text-4xl mb-4">🏆</div>
          <h3 className="text-xl font-bold text-white mb-2 group-hover:text-purple-400 transition-colors">Leaderboard</h3>
          <p className="text-slate-400">Top traders ranked by profit & loss performance.</p>
        </Link>

        <div className="glass rounded-2xl p-8 card-hover">
          <div className="text-4xl mb-4">💰</div>
          <h3 className="text-xl font-bold text-white mb-2">P&L Tracking</h3>
          <p className="text-slate-400">Track realized and unrealized gains for any wallet.</p>
        </div>
      </div>

      {/* Recent Activity */}
      {recentTrades.length > 0 && (
        <div className="glass rounded-2xl p-6">
          <h2 className="text-xl font-bold text-white mb-4">Recent Trades</h2>
          <div className="space-y-3">
            {recentTrades.map((trade: RecentTrade) => (
              <div key={trade.id} className="flex items-center justify-between py-3 border-b border-slate-800 last:border-0">
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${trade.isBuy ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                    {trade.isBuy ? "BUY" : "SELL"}
                  </span>
                  <Link href={`/address/${trade.trader}`} className="font-mono text-sm text-slate-300 hover:text-purple-400">
                    {trade.trader.slice(0, 8)}...{trade.trader.slice(-6)}
                  </Link>
                </div>
                <div className="text-right">
                  <div className="text-sm text-white">{formatNumber(Number(trade.tokensDelta) / 1e18)} TEST</div>
                  <div className="text-xs text-slate-500">Market #{trade.marketId.toString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
