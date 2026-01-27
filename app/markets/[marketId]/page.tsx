import Link from "next/link";
import prisma from "@/lib/prisma";
import { formatTokens, formatAddress, formatTimeAgo } from "@/lib/utils";
import { LINKS } from "@/lib/constants";
import StatCard from "@/components/ui/StatCard";
import { MARKETS, VALID_MARKET_IDS, getMarketConfig } from "@/lib/markets-config";

export const dynamic = "force-dynamic";

const MODEL_COLORS = [
  "#3B82F6", "#F97316", "#10B981", "#8B5CF6", "#EC4899",
  "#14B8A6", "#F59E0B", "#EF4444", "#6366F1", "#84CC16",
];

interface PageProps {
  params: { marketId: string };
}

async function getMarketData(internalId: string) {
  try {
    const config = getMarketConfig(internalId);
    if (!config) return null;

    const market = await prisma.market.findUnique({
      where: { marketId: BigInt(internalId) },
      include: {
        _count: { select: { trades: true } },
      },
    });

    // Get recent trades
    const recentTrades = await prisma.trade.findMany({
      where: { marketId: BigInt(internalId) },
      orderBy: { blockTime: "desc" },
      take: 20,
      select: {
        id: true,
        trader: true,
        isBuy: true,
        tokensDelta: true,
        sharesDelta: true,
        modelIdx: true,
        blockTime: true,
        txHash: true,
        impliedProbability: true,
      },
    });

    return {
      internalId,
      displayId: config.displayId,
      title: config.title,
      status: config.status,
      totalTrades: market?._count.trades || 0,
      totalVolume: market?.totalVolume?.toString() || "0",
      endDate: config.endDate,
      settledAt: market?.settledAt,
      winnerIdx: config.winnerIdx,
      models: config.models,
      recentTrades,
    };
  } catch (e) {
    console.error("Market fetch error:", e);
    return null;
  }
}

export default async function MarketDetailPage({ params }: PageProps) {
  const { marketId: internalId } = params;

  // Validate market ID
  if (!VALID_MARKET_IDS.includes(internalId)) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="card p-12 text-center">
          <p className="text-red-400 text-lg">Market not found</p>
          <Link href="/markets" className="mt-4 inline-block text-blue-400 hover:underline">
            ← Back to Markets
          </Link>
        </div>
      </div>
    );
  }

  const market = await getMarketData(internalId);

  if (!market) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="card p-12 text-center">
          <p className="text-red-400 text-lg">Market not found</p>
          <Link href="/markets" className="mt-4 inline-block text-blue-400 hover:underline">
            ← Back to Markets
          </Link>
        </div>
      </div>
    );
  }

  const isSettled = market.status === "settled";
  const winnerModel = market.winnerIdx !== undefined 
    ? market.models.find(m => m.idx === market.winnerIdx)
    : undefined;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <Link href="/markets" className="text-sm text-zinc-500 hover:text-zinc-300 mb-2 inline-block">
          ← Markets
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Market #{market.displayId}</h1>
            <p className="text-zinc-400">{market.title}</p>
          </div>
          <span className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium ${
            isSettled ? "badge-settled" : "badge-active"
          }`}>
            {isSettled ? "Settled" : "Active"}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Total Trades"
          value={market.totalTrades.toLocaleString()}
          color="blue"
        />
        <StatCard
          title="Volume"
          value={formatTokens(market.totalVolume)}
          subtitle="$TEST"
          color="green"
        />
        <StatCard
          title={isSettled ? "Settled" : "Ends"}
          value={market.endDate || "—"}
          color="purple"
        />
        <StatCard
          title="Models"
          value={market.models.length}
          color="cyan"
        />
      </div>

      {/* Winner Banner (for settled markets) */}
      {isSettled && winnerModel && (
        <div className="card p-6 mb-8 bg-gradient-to-r from-amber-500/10 to-amber-500/5 border-amber-500/30">
          <div className="flex items-center gap-4">
            <div className="text-4xl">🏆</div>
            <div>
              <p className="text-sm text-amber-400/70 mb-1">Winner</p>
              <p className="text-xl font-bold text-amber-300">{winnerModel.name}</p>
            </div>
          </div>
        </div>
      )}

      {/* Models List */}
      <div className="card p-6 mb-8">
        <h2 className="text-lg font-semibold text-white mb-4">Models</h2>
        <div className="space-y-3">
          {market.models.map((model) => {
            const isWinner = isSettled && market.winnerIdx === model.idx;
            return (
              <div
                key={model.idx}
                className={`flex items-center justify-between p-4 rounded-lg ${
                  isWinner
                    ? "bg-amber-500/10 border border-amber-500/30"
                    : "bg-zinc-800/50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: MODEL_COLORS[model.idx % MODEL_COLORS.length] }}
                  />
                  <span className="text-zinc-400 font-mono text-sm">#{model.idx}</span>
                  <span className={`font-medium ${isWinner ? "text-amber-300" : "text-white"}`}>
                    {model.name}
                  </span>
                  {isWinner && <span className="text-amber-400">🏆</span>}
                </div>
                <span className="text-sm text-zinc-500">{model.family}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Trades */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-[var(--border-color)]">
          <h2 className="font-semibold text-white">Recent Trades</h2>
        </div>
        {market.recentTrades.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs text-zinc-500 border-b border-[var(--border-color)]">
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Trader</th>
                  <th className="px-4 py-3 font-medium">Model</th>
                  <th className="px-4 py-3 font-medium text-right">Amount</th>
                  <th className="px-4 py-3 font-medium text-right">Price</th>
                  <th className="px-4 py-3 font-medium text-right">Time</th>
                </tr>
              </thead>
              <tbody>
                {market.recentTrades.map((trade: any) => {
                  const modelInfo = market.models.find(m => m.idx === Number(trade.modelIdx));
                  const modelName = modelInfo?.name || `Model ${trade.modelIdx}`;
                  return (
                    <tr
                      key={trade.id}
                      className="table-row border-b border-[var(--border-color)] last:border-0"
                    >
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
                          className="font-mono text-sm text-zinc-300 hover:text-blue-400"
                        >
                          {formatAddress(trade.trader, 4)}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: MODEL_COLORS[Number(trade.modelIdx) % MODEL_COLORS.length] }}
                          />
                          <span className="text-sm text-zinc-300 truncate max-w-[150px]">
                            {modelName}
                          </span>
                        </div>
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
                        <a
                          href={LINKS.tx(trade.txHash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-zinc-500 hover:text-zinc-300"
                        >
                          {formatTimeAgo(trade.blockTime)}
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-zinc-500">No trades yet</div>
        )}
      </div>

      {/* Links */}
      <div className="mt-8 card p-6">
        <h2 className="font-semibold text-white mb-4">Links</h2>
        <div className="flex flex-wrap gap-4">
          <a
            href={`https://delphi.gensyn.ai/markets/${internalId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
          >
            Trade on Delphi
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
          <a
            href={LINKS.contract}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white font-medium transition-colors"
          >
            View Contract
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
}
