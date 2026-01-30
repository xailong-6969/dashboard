import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { VALID_MARKET_IDS_BIGINT, MARKET_WINNERS } from "@/lib/markets-config";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const revalidate = 600; // Cache for 10 minutes

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50")));
    const sortBy = searchParams.get("sortBy") || "pnl";
    const search = searchParams.get("search")?.toLowerCase();

    // Get ALL trades for valid markets - MUST order by blockTime
    const allTrades = await prisma.trade.findMany({
      where: { marketId: { in: VALID_MARKET_IDS_BIGINT } },
      select: {
        trader: true,
        marketId: true,
        modelIdx: true,
        isBuy: true,
        tokensDelta: true,
        sharesDelta: true,
      },
      orderBy: { blockTime: "asc" },
    });

    // Calculate stats per trader using INDEXER's exact formula:
    // P&L = totalReceived + settlementPayout - totalSpent
    const traderStats = new Map<string, {
      address: string;
      totalSpent: bigint;
      totalReceived: bigint;
      totalVolume: bigint;
      totalTrades: number;
      positions: Map<string, { shares: bigint; cost: bigint }>;
    }>();

    for (const trade of allTrades) {
      const address = trade.trader.toLowerCase();
      let stats = traderStats.get(address);

      if (!stats) {
        stats = {
          address: trade.trader,
          totalSpent: 0n,
          totalReceived: 0n,
          totalVolume: 0n,
          totalTrades: 0,
          positions: new Map(),
        };
        traderStats.set(address, stats);
      }

      const tokens = BigInt(trade.tokensDelta);
      const shares = BigInt(trade.sharesDelta);
      const absTokens = tokens < 0n ? -tokens : tokens;

      stats.totalVolume += absTokens;
      stats.totalTrades += 1;

      const posKey = `${trade.marketId}:${trade.modelIdx}`;
      let pos = stats.positions.get(posKey) || { shares: 0n, cost: 0n };

      if (trade.isBuy) {
        stats.totalSpent += absTokens;
        pos.shares += shares;
        pos.cost += absTokens;
      } else {
        stats.totalReceived += absTokens;
        // Reduce shares - use same logic as indexer
        if (pos.shares > 0n) {
          const sharesToRemove = shares > pos.shares ? pos.shares : shares;
          pos.shares -= sharesToRemove;
        }
      }

      stats.positions.set(posKey, pos);
    }

    // Calculate P&L with settlement
    let traders = Array.from(traderStats.values()).map(stats => {
      let settlementPayout = 0n;

      // Add settlement payout for winning positions
      for (const [posKey, pos] of stats.positions.entries()) {
        const [marketIdStr, modelIdxStr] = posKey.split(":");
        const winnerIdx = MARKET_WINNERS[marketIdStr];

        // If market is settled and trader holds winning shares
        if (winnerIdx !== undefined && winnerIdx.toString() === modelIdxStr) {
          settlementPayout += pos.shares;
        }
      }

      // P&L = totalReceived + settlementPayout - totalSpent
      const realizedPnl = stats.totalReceived + settlementPayout - stats.totalSpent;

      return {
        address: stats.address,
        realizedPnl: realizedPnl.toString(),
        totalVolume: stats.totalVolume.toString(),
        totalTrades: stats.totalTrades,
      };
    });

    // Sort ALL traders
    traders.sort((a, b) => {
      if (sortBy === "volume") {
        return Number(BigInt(b.totalVolume) - BigInt(a.totalVolume));
      } else if (sortBy === "trades") {
        return b.totalTrades - a.totalTrades;
      }
      return Number(BigInt(b.realizedPnl) - BigInt(a.realizedPnl));
    });

    // Assign ranks
    const tradersWithRank = traders.map((t, idx) => ({
      ...t,
      rank: idx + 1,
    }));

    const totalTraders = tradersWithRank.length;

    // Handle search
    if (search) {
      const found = tradersWithRank.filter(t =>
        t.address.toLowerCase().includes(search)
      );
      return NextResponse.json({
        leaderboard: found,
        totalTraders,
        totalPages: 1,
        currentPage: 1,
      });
    }

    // Paginate
    const totalPages = Math.ceil(totalTraders / limit);
    const offset = (page - 1) * limit;
    const paginated = tradersWithRank.slice(offset, offset + limit);

    return NextResponse.json({
      leaderboard: paginated,
      totalTraders,
      totalPages,
      currentPage: page,
    });
  } catch (error) {
    console.error("Leaderboard error:", error);
    return NextResponse.json({
      leaderboard: [],
      totalTraders: 0,
      totalPages: 0,
      currentPage: 1,
      error: "Failed to fetch leaderboard",
    });
  }
}
