import Link from "next/link";
import prisma from "@/lib/prisma";
import { formatNumber, formatAddress } from "@/lib/utils";

export const dynamic = "force-dynamic";

async function getLeaderboard() {
  try {
    const trades = await prisma.trade.findMany({
      select: {
        trader: true,
        isBuy: true,
        tokensDelta: true,
      },
    });

    const traderStats = new Map<string, { trades: number; volume: bigint; buys: number; sells: number }>();

    for (const trade of trades) {
      const existing = traderStats.get(trade.trader) || { trades: 0, volume: 0n, buys: 0, sells: 0 };
      existing.trades += 1;
      existing.volume += BigInt(trade.tokensDelta);
      if (trade.isBuy) existing.buys += 1;
      else existing.sells += 1;
      traderStats.set(trade.trader, existing);
    }

    const sorted = Array.from(traderStats.entries())
      .map(([address, stats]) => ({ address, ...stats }))
      .sort((a, b) => (b.volume > a.volume ? 1 : -1))
      .slice(0, 50);

    return sorted;
  } catch (e) {
    return [];
  }
}

export default async function LeaderboardPage() {
  const leaderboard = await getLeaderboard();

  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">🏆 Leaderboard</h1>
        <p className="text-slate-400">Top traders by trading volume</p>
      </div>

      {leaderboard.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <p className="text-slate-400 text-lg">No trading data yet. The indexer may still be syncing.</p>
        </div>
      ) : (
        <div className="glass rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead className="border-b border-slate-800">
              <tr className="text-left text-sm text-slate-400">
                <th className="px-6 py-4 font-medium">Rank</th>
                <th className="px-6 py-4 font-medium">Trader</th>
                <th className="px-6 py-4 font-medium text-right">Volume (TEST)</th>
                <th className="px-6 py-4 font-medium text-right">Trades</th>
                <th className="px-6 py-4 font-medium text-right">Buys/Sells</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((trader, i) => (
                <tr key={trader.address} className="border-b border-slate-800/50 hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4">
                    <span className={`text-lg font-bold ${
                      i === 0 ? "text-yellow-400" :
                      i === 1 ? "text-slate-300" :
                      i === 2 ? "text-amber-600" :
                      "text-slate-400"
                    }`}>
                      #{i + 1}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <Link href={`/address/${trader.address}`} className="font-mono text-purple-400 hover:text-cyan-400 transition-colors">
                      {formatAddress(trader.address, 6)}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-white">
                    {formatNumber(Number(trader.volume) / 1e18)}
                  </td>
                  <td className="px-6 py-4 text-right text-slate-300">
                    {trader.trades}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-green-400">{trader.buys}</span>
                    <span className="text-slate-500"> / </span>
                    <span className="text-red-400">{trader.sells}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
