import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAddress } from "viem";
import { VALID_MARKET_IDS_BIGINT, MARKET_WINNERS } from "@/lib/markets-config";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const revalidate = 600; // Cache for 10 minutes

function isHexAddress(a: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(a);
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address: rawAddress } = await params;

  if (!rawAddress || !isHexAddress(rawAddress)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  try {
    const address = getAddress(rawAddress);

    // Get all trades for this address - same markets as leaderboard
    const trades = await prisma.trade.findMany({
      where: {
        trader: address,
        marketId: { in: VALID_MARKET_IDS_BIGINT }
      },
      orderBy: { blockTime: "asc" },
      select: {
        isBuy: true,
        tokensDelta: true,
        sharesDelta: true,
        marketId: true,
        modelIdx: true,
        blockTime: true,
      },
    });

    // Calculate stats using INDEXER's exact formula:
    // P&L = totalReceived + settlementPayout - totalSpent
    let totalVolume = 0n;
    let buyVolume = 0n;
    let sellVolume = 0n;
    let buyCount = 0;
    let sellCount = 0;
    let totalSpent = 0n;
    let totalReceived = 0n;

    const marketsTraded = new Set<string>();
    const modelsTraded = new Set<string>();
    const positions = new Map<string, { shares: bigint; cost: bigint }>();

    for (const trade of trades) {
      const tokens = BigInt(trade.tokensDelta);
      const shares = BigInt(trade.sharesDelta);
      const absTokens = tokens < 0n ? -tokens : tokens;

      totalVolume += absTokens;
      marketsTraded.add(trade.marketId.toString());
      modelsTraded.add(`${trade.marketId}:${trade.modelIdx}`);

      const posKey = `${trade.marketId}:${trade.modelIdx}`;
      let pos = positions.get(posKey) || { shares: 0n, cost: 0n };

      if (trade.isBuy) {
        buyCount++;
        buyVolume += absTokens;
        totalSpent += absTokens;
        pos.shares += shares;
        pos.cost += absTokens;
      } else {
        sellCount++;
        sellVolume += absTokens;
        totalReceived += absTokens;
        // Reduce shares - same logic as indexer
        if (pos.shares > 0n) {
          const sharesToRemove = shares > pos.shares ? pos.shares : shares;
          pos.shares -= sharesToRemove;
        }
      }
      positions.set(posKey, pos);
    }

    // Calculate settlement P&L
    let settlementPayout = 0n;
    let openPositions = 0;
    let unrealizedCostBasis = 0n;

    for (const [posKey, pos] of positions.entries()) {
      const [marketId, modelIdx] = posKey.split(":");
      const winnerIdx = MARKET_WINNERS[marketId];

      if (pos.shares > 0n) {
        if (winnerIdx !== undefined) {
          // Market is settled - add settlement payout for winning shares
          if (winnerIdx.toString() === modelIdx) {
            settlementPayout += pos.shares;
          }
          // Losing shares get 0, no action needed
        } else {
          // Market not settled
          openPositions++;
          unrealizedCostBasis += pos.cost;
        }
      }
    }

    // P&L = totalReceived + settlementPayout - totalSpent
    const realizedPnl = totalReceived + settlementPayout - totalSpent;

    return NextResponse.json({
      address,
      totalTrades: trades.length,
      totalVolume: totalVolume.toString(),
      buyVolume: buyVolume.toString(),
      sellVolume: sellVolume.toString(),
      buyCount,
      sellCount,
      marketsTraded: marketsTraded.size,
      modelsTraded: modelsTraded.size,
      openPositions,
      realizedPnl: realizedPnl.toString(),
      totalCostBasis: totalSpent.toString(),
      unrealizedCostBasis: unrealizedCostBasis.toString(),
      firstTrade: trades[0]?.blockTime || null,
      lastTrade: trades[trades.length - 1]?.blockTime || null,
    });
  } catch (e) {
    console.error("Address stats error:", e);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
