import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { runIndexer, recalculateTraderStats, updateMarketVolumes } from "@/lib/indexer/core";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // 60 seconds max for Vercel/Railway

// Secret key for triggering indexer (set in env)
const INDEXER_SECRET = process.env.INDEXER_SECRET || "default-secret-change-me";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");
  const action = url.searchParams.get("action") || "index";
  
  // Check authorization
  if (secret !== INDEXER_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    switch (action) {
      case "index": {
        // Run incremental indexing
        const result = await runIndexer(prisma, {
          batchSize: 50,
          onProgress: (current, target) => {
            console.log(`Progress: ${current}/${target}`);
          },
        });
        return NextResponse.json({
          success: true,
          action: "index",
          ...result,
        });
      }

      case "recalculate": {
        // Recalculate all trader stats
        await recalculateTraderStats(prisma);
        await updateMarketVolumes(prisma);
        return NextResponse.json({
          success: true,
          action: "recalculate",
        });
      }

      case "status": {
        // Get indexer status
        const state = await prisma.indexerState.findUnique({
          where: { id: "delphi" },
        });
        const tradeCount = await prisma.trade.count();
        const marketCount = await prisma.market.count();
        
        return NextResponse.json({
          success: true,
          state,
          tradeCount,
          marketCount,
        });
      }

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Indexer error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// POST for webhook-style triggers (Railway cron, etc.)
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const secret = body.secret || req.headers.get("x-indexer-secret");
    
    if (secret !== INDEXER_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await runIndexer(prisma, { batchSize: 50 });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Indexer POST error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
