import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAddress } from "viem";

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

    // Get all trades for P&L calculation
    const trades = await prisma.trade.findMany({
      where: { trader: address },
      orderBy: { blockTime: "asc" },
      select: {
        marketId: true,
        modelIdx: true,
        isBuy: true,
        tokensDelta: true,
        sharesDelta: true,
        market: {
          select: {
            title: true,
            status: true,
            winningModelIdx: true,
            modelsJson: true,
          },
        },
      },
    });

    // Calculate positions
    const positions = new Map<string, {
      marketId: bigint;
      modelIdx: bigint;
      shares: bigint;
      cost: bigint;
      realized: bigint;
      tradeCount: number;
      marketTitle: string | null;
      marketStatus: number | null;
      winningModelIdx: bigint | null;
    }>();

    for (const trade of trades) {
      const key = `${trade.marketId}:${trade.modelIdx}`;
      let pos = positions.get(key);

      if (!pos) {
        pos = {
          marketId: trade.marketId,
          modelIdx: trade.modelIdx,
          shares: 0n,
          cost: 0n,
          realized: 0n,
          tradeCount: 0,
          marketTitle: trade.market?.title || null,
          marketStatus: trade.market?.status ?? null,
          winningModelIdx: trade.market?.winningModelIdx ?? null,
        };
        positions.set(key, pos);
      }

      const tokens = BigInt(trade.tokensDelta);
      const shares = BigInt(trade.sharesDelta);
      pos.tradeCount++;

      if (trade.isBuy) {
        pos.shares += shares;
        pos.cost += tokens;
      } else {
        if (pos.shares > 0n) {
          const avgCost = pos.cost / pos.shares;
          const costRemoved = avgCost * shares;
          pos.realized += tokens - costRemoved;
          pos.shares -= shares;
          pos.cost = pos.cost > costRemoved ? pos.cost - costRemoved : 0n;
        } else {
          pos.realized += tokens;
        }
      }
    }

    // Format output
    const openPositions: any[] = [];
    const closedPositions: any[] = [];
    let totalRealizedPnl = 0n;
    let totalUnrealizedCost = 0n;

    for (const pos of positions.values()) {
      totalRealizedPnl += pos.realized;

      const formatted = {
        marketId: pos.marketId.toString(),
        modelIdx: pos.modelIdx.toString(),
        marketTitle: pos.marketTitle,
        marketStatus: pos.marketStatus,
        isWinner: pos.winningModelIdx !== null && pos.winningModelIdx === pos.modelIdx,
        sharesHeld: pos.shares.toString(),
        costBasis: pos.cost.toString(),
        realizedPnl: pos.realized.toString(),
        tradeCount: pos.tradeCount,
      };

      if (pos.shares > 0n) {
        openPositions.push(formatted);
        totalUnrealizedCost += pos.cost;
      } else if (pos.realized !== 0n || pos.tradeCount > 0) {
        closedPositions.push(formatted);
      }
    }

    return NextResponse.json({
      address,
      summary: {
        totalRealizedPnl: totalRealizedPnl.toString(),
        totalUnrealizedCost: totalUnrealizedCost.toString(),
        openPositionCount: openPositions.length,
        closedPositionCount: closedPositions.length,
      },
      openPositions,
      closedPositions,
    });
  } catch (e) {
    console.error("Address positions error:", e);
    return NextResponse.json({ error: "Failed to fetch positions" }, { status: 500 });
  }
}
