import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { VALID_MARKET_IDS_BIGINT, MARKET_WINNERS } from "@/lib/markets-config";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50")));
    const sortBy = searchParams.get("sortBy") || "pnl";
    const search = searchParams.get("search")?.toLowerCase();

    // Get ALL trades for valid markets
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
    });

    // Calculate stats per trader
    const traderStats = new Map<string, {
      address: string;
      realizedPnl: bigint;
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
          realizedPnl: 0n,
          totalVolume: 0n,
          totalTrades: 0,
          positions: new Map(),
        };
        traderStats.set(address, stats);
      }

      const tokens = BigInt(trade.tokensDelta);
      const shares = BigInt(trade.sharesDelta);
      const absTokens = tokens < 0n ? -tokens : tokens;
      const absShares = shares < 0n ? -shares : shares;

      stats.totalVolume += absTokens;
      stats.totalTrades += 1;

      const posKey = `${trade.marketId}:${trade.modelIdx}`;
      let pos = stats.positions.get(posKey) || { shares: 0n, cost: 0n };

      if (trade.isBuy) {
        pos.shares += absShares;
        pos.cost += absTokens;
      } else {
        if (pos.shares > 0n) {
          const avgCost = (pos.cost * BigInt(1e18)) / pos.shares;
          const costBasis = (avgCost * absShares) / BigInt(1e18);
          const pnl = absTokens - costBasis;
          stats.realizedPnl += pnl;

          pos.shares -= absShares;
          pos.cost -= costBasis;
          if (pos.shares < 0n) pos.shares = 0n;
          if (pos.cost < 0n) pos.cost = 0n;
        } else {
          stats.realizedPnl += absTokens;
        }
      }

      stats.positions.set(posKey, pos);
    }

    // Add settlement P&L
    for (const [, stats] of traderStats) {
      for (const [posKey, pos] of stats.positions) {
        if (pos.shares > 0n) {
          const [marketId, modelIdx] = posKey.split(":");
          const winnerIdx = MARKET_WINNERS[marketId];

          if (winnerIdx !== undefined) {
            if (Number(modelIdx) === winnerIdx) {
              stats.realizedPnl += pos.shares - pos.cost;
            } else {
              stats.realizedPnl -= pos.cost;
            }
          }
        }
      }
    }

    // Convert to array
    let traders = Array.from(traderStats.values()).map(t => ({
      address: t.address,
      realizedPnl: t.realizedPnl.toString(),
      totalVolume: t.totalVolume.toString(),
      totalTrades: t.totalTrades,
    }));

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
