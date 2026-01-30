import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { runIndexer, recalculateTraderStats, updateMarketVolumes } from "@/lib/indexer/core";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Verify secret
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get("secret");

    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check database lock with 5-minute expiration
    const lockExpiration = 5 * 60 * 1000;
    const state = await prisma.indexerState.findUnique({
      where: { id: "delphi" },
    });

    if (state?.isRunning) {
      const lockAge = Date.now() - (state.updatedAt?.getTime() || 0);
      if (lockAge < lockExpiration) {
        return NextResponse.json({
          success: false,
          message: "Indexer already running",
          lockAge: Math.round(lockAge / 1000) + "s",
        });
      }
      console.log("⚠️ Stale lock detected, proceeding...");
    }

    // Set lock
    await prisma.indexerState.upsert({
      where: { id: "delphi" },
      update: { isRunning: true, updatedAt: new Date() },
      create: { id: "delphi", isRunning: true, lastBlock: BigInt(0) },
    });

    console.log("\n" + "=".repeat(50));
    console.log("🚀 CRON JOB STARTED at", new Date().toISOString());
    console.log("=".repeat(50));

    // Run blockchain indexer
    console.log("\n⛓️ Blockchain Indexing...");
    const result = await runIndexer(prisma);
    console.log(`📈 Indexed ${result.indexed} new trades`);
    console.log(`📦 Last block: ${result.lastBlock}`);

    // Always update stats and market volumes (not just when new trades)
    // This ensures volumes stay in sync even after restarts
    console.log("\n📊 Updating Stats...");
    const updated = await recalculateTraderStats(prisma);
    console.log(`✅ Updated ${updated} trader stats`);

    console.log("\n📈 Updating Market Volumes...");
    await updateMarketVolumes(prisma);
    console.log(`✅ Market volumes updated`);

    const duration = Date.now() - startTime;
    console.log(`\n✅ CRON COMPLETED in ${duration}ms`);

    return NextResponse.json({
      success: true,
      indexed: result.indexed,
      lastBlock: result.lastBlock.toString(),
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Cron error:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  } finally {
    // Always release lock
    await prisma.indexerState.update({
      where: { id: "delphi" },
      data: { isRunning: false, updatedAt: new Date() },
    }).catch(() => { });
  }
}
