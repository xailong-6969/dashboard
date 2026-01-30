import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Use TraderStats table which is pre-computed by the indexer
// This avoids loading 600K+ trades into memory
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50")));
    const sortBy = searchParams.get("sortBy") || "pnl";
    const search = searchParams.get("search")?.toLowerCase();

    // Build order by clause
    let orderBy: Record<string, "asc" | "desc"> = {};
    if (sortBy === "volume") {
      orderBy = { totalVolume: "desc" };
    } else if (sortBy === "trades") {
      orderBy = { totalTrades: "desc" };
    } else {
      orderBy = { realizedPnl: "desc" };
    }

    // Handle search
    if (search) {
      const found = await prisma.traderStats.findMany({
        where: {
          address: { contains: search, mode: "insensitive" },
          totalTrades: { gt: 0 },
        },
        orderBy,
        take: 100,
      });

      const results = found.map((t, idx) => ({
        address: t.address,
        realizedPnl: t.realizedPnl,
        totalVolume: t.totalVolume,
        totalTrades: t.totalTrades,
        rank: idx + 1,
      }));

      return NextResponse.json({
        leaderboard: results,
        totalTraders: results.length,
        totalPages: 1,
        currentPage: 1,
      });
    }

    // Get total count of traders with trades
    const totalTraders = await prisma.traderStats.count({
      where: { totalTrades: { gt: 0 } },
    });

    const offset = (page - 1) * limit;

    // Fetch paginated data directly from database
    const traders = await prisma.traderStats.findMany({
      where: { totalTrades: { gt: 0 } },
      orderBy,
      skip: offset,
      take: limit,
      select: {
        address: true,
        realizedPnl: true,
        totalVolume: true,
        totalTrades: true,
      },
    });

    // Add ranks based on page offset
    const tradersWithRank = traders.map((t, idx) => ({
      address: t.address,
      realizedPnl: t.realizedPnl,
      totalVolume: t.totalVolume,
      totalTrades: t.totalTrades,
      rank: offset + idx + 1,
    }));

    const totalPages = Math.ceil(totalTraders / limit);

    return NextResponse.json({
      leaderboard: tradersWithRank,
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
