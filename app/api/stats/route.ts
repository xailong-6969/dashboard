import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { VALID_MARKET_IDS_BIGINT } from "@/lib/markets-config";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Cache stats for 15 seconds to balance speed and freshness
let cachedStats: any = null;
let cacheTime: number = 0;
const CACHE_DURATION = 15 * 1000; // 15 seconds

export async function GET() {
  try {
    // Return cached stats if still fresh
    if (cachedStats && Date.now() - cacheTime < CACHE_DURATION) {
      return NextResponse.json(cachedStats);
    }

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Optimized queries using database aggregations
    const [
      activeCount,
      settledCount,
      totalTradesCount,
      uniqueTradersCount,
      indexerState,
      recentTrades,
      trades24hCount,
      marketData,
      // Calculate 24h volume using SUM directly in database
      volume24hRaw,
    ] = await Promise.all([
      // Active markets count
      prisma.market.count({
        where: {
          status: 0,
          marketId: { in: VALID_MARKET_IDS_BIGINT }
        }
      }),
      // Settled markets count
      prisma.market.count({
        where: {
          status: 2,
          marketId: { in: VALID_MARKET_IDS_BIGINT }
        }
      }),
      // Total trades count (fast)
      prisma.trade.count(),
      // Unique traders count using raw SQL for performance
      prisma.$queryRaw<[{ count: bigint }]>`SELECT COUNT(DISTINCT trader) as count FROM "Trade"`,
      // Indexer state
      prisma.indexerState.findUnique({ where: { id: "delphi" } }),
      // Recent trades (already limited)
      prisma.trade.findMany({
        orderBy: { blockTime: "desc" },
        take: 10,
        select: {
          id: true,
          trader: true,
          isBuy: true,
          tokensDelta: true,
          blockTime: true,
          marketId: true,
          modelIdx: true,
          impliedProbability: true,
        },
      }),
      // 24h trades count
      prisma.trade.count({
        where: {
          blockTime: { gte: oneDayAgo }
        }
      }),
      // Get total volume from ALL valid markets
      prisma.market.findMany({
        where: { marketId: { in: VALID_MARKET_IDS_BIGINT } },
        select: { marketId: true, totalVolume: true, totalTrades: true }
      }),
      // Calculate 24h volume directly in database (more accurate)
      prisma.$queryRaw<[{ total_volume: string | null, buy_count: string, sell_count: string }]>`
        SELECT 
          COALESCE(SUM(ABS(CAST("tokensDelta" AS NUMERIC))), 0)::TEXT as total_volume,
          COUNT(*) FILTER (WHERE "isBuy" = true)::TEXT as buy_count,
          COUNT(*) FILTER (WHERE "isBuy" = false)::TEXT as sell_count
        FROM "Trade" 
        WHERE "blockTime" >= ${oneDayAgo}
      `,
    ]);

    // Calculate total volume from pre-computed market volumes
    let totalVolume = 0n;
    for (const m of marketData) {
      if (m.totalVolume) {
        totalVolume += BigInt(m.totalVolume);
      }
    }

    // Parse 24h volume from database query result
    const volume24hResult = volume24hRaw[0];
    const volume24h = BigInt(volume24hResult?.total_volume || "0");
    const buys24h = parseInt(volume24hResult?.buy_count || "0", 10);
    const sells24h = parseInt(volume24hResult?.sell_count || "0", 10);

    const stats = {
      totalTrades: totalTradesCount,
      totalMarkets: activeCount + settledCount,
      activeMarkets: activeCount,
      settledMarkets: settledCount,
      uniqueTraders: Number(uniqueTradersCount[0]?.count || 0),
      totalVolume: totalVolume.toString(),
      totalVolumeFormatted: formatVolume(totalVolume),
      trades24h: trades24hCount,
      volume24h: volume24h.toString(),
      volume24hFormatted: formatVolume(volume24h),
      buys24h,
      sells24h,
      lastIndexedBlock: indexerState?.lastBlock?.toString() || "0",
      lastIndexedAt: indexerState?.updatedAt?.toISOString(),
      isIndexerRunning: indexerState?.isRunning || false,
      recentTrades: recentTrades.map((t) => ({
        id: t.id,
        trader: t.trader,
        isBuy: t.isBuy,
        tokensDelta: t.tokensDelta,
        blockTime: t.blockTime?.toISOString(),
        marketId: t.marketId.toString(),
        modelIdx: t.modelIdx.toString(),
        impliedProbability: t.impliedProbability,
      })),
      // Include per-market volumes for debugging
      marketVolumes: marketData.map(m => ({
        marketId: m.marketId.toString(),
        volume: m.totalVolume || "0",
        trades: m.totalTrades || 0,
      })),
    };

    // Cache the result
    cachedStats = stats;
    cacheTime = Date.now();

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Stats error:", error);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}

function formatVolume(volume: bigint): string {
  const num = Number(volume) / 1e18;
  if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(2) + "B";
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + "M";
  if (num >= 1_000) return (num / 1_000).toFixed(2) + "K";
  return num.toFixed(2);
}
