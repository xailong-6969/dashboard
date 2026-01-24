import prisma from "@/lib/prisma";
import { formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface MarketWithCount {
  marketId: bigint;
  configUri: string | null;
  configUriHash: string | null;
  createdAtBlock: bigint | null;
  createdAtTime: Date | null;
  modelsJson: any;
  winningModelIdx: bigint | null;
  status: number;
  _count: {
    trades: number;
  };
}

async function getMarkets(): Promise<MarketWithCount[]> {
  try {
    const markets = await prisma.market.findMany({
      orderBy: { createdAtTime: "desc" },
      take: 50,
      include: {
        _count: { select: { trades: true } },
      },
    });
    return markets;
  } catch (e) {
    return [];
  }
}

export default async function MarketsPage() {
  const markets = await getMarkets();

  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">Markets</h1>
        <p className="text-slate-400">All Delphi prediction markets on Gensyn Testnet</p>
      </div>

      {markets.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <p className="text-slate-400 text-lg">No markets found. The indexer may still be syncing.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {markets.map((market: MarketWithCount) => (
            <div key={market.marketId.toString()} className="glass rounded-2xl p-6 card-hover">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="text-sm text-slate-400">Market</div>
                  <div className="text-2xl font-bold text-white">#{market.marketId.toString()}</div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  market.status === 0 ? "bg-green-500/20 text-green-400" :
                  market.status === 2 ? "bg-purple-500/20 text-purple-400" :
                  "bg-slate-500/20 text-slate-400"
                }`}>
                  {market.status === 0 ? "Active" : market.status === 2 ? "Settled" : "Unknown"}
                </span>
              </div>
              
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Total Trades</span>
                  <span className="text-white font-medium">{market._count.trades}</span>
                </div>
                {market.createdAtTime && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Created</span>
                    <span className="text-white">{new Date(market.createdAtTime).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
