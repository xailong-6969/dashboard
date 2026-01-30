import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAddress } from "viem";

export const dynamic = "force-dynamic";

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

    // Get all trades for this address
    const trades = await prisma.trade.findMany({
      where: { trader: address },
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

    // Calculate stats
    let totalVolume = 0n;
    let buyVolume = 0n;
    let sellVolume = 0n;
    let buyCount = 0;
    let sellCount = 0;

    const marketsTraded = new Set<string>();
    const modelsTraded = new Set<string>();

    // P&L calculation
    const positions = new Map<string, { shares: bigint; cost: bigint; realized: bigint }>();
    let totalRealizedPnl = 0n;
    let totalCostBasis = 0n;

    for (const trade of trades) {
      const tokens = BigInt(trade.tokensDelta);
      const shares = BigInt(trade.sharesDelta);
      totalVolume += tokens;

      marketsTraded.add(trade.marketId.toString());
      modelsTraded.add(`${trade.marketId}:${trade.modelIdx}`);

      const posKey = `${trade.marketId}:${trade.modelIdx}`;
      let pos = positions.get(posKey) || { shares: 0n, cost: 0n, realized: 0n };

      if (trade.isBuy) {
        buyCount++;
        buyVolume += tokens;
        pos.shares += shares;
        pos.cost += tokens;
        totalCostBasis += tokens;
      } else {
        sellCount++;
        sellVolume += tokens;
        if (pos.shares > 0n) {
          const avgCost = pos.cost / pos.shares;
          const costRemoved = avgCost * shares;
          const pnl = tokens - costRemoved;
          pos.realized += pnl;
          totalRealizedPnl += pnl;
          pos.shares -= shares;
          pos.cost = pos.cost > costRemoved ? pos.cost - costRemoved : 0n;
        } else {
          pos.realized += tokens;
          totalRealizedPnl += tokens;
        }
      }
      positions.set(posKey, pos);
    }

    // Count open positions
    let openPositions = 0;
    let unrealizedCostBasis = 0n;
    for (const pos of positions.values()) {
      if (pos.shares > 0n) {
        openPositions++;
        unrealizedCostBasis += pos.cost;
      }
    }

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
      realizedPnl: totalRealizedPnl.toString(),
      totalCostBasis: totalCostBasis.toString(),
      unrealizedCostBasis: unrealizedCostBasis.toString(),
      firstTrade: trades[0]?.blockTime || null,
      lastTrade: trades[trades.length - 1]?.blockTime || null,
    });
  } catch (e) {
    console.error("Address stats error:", e);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
