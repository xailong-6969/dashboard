import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getAddress } from "viem";

// Prevent Next.js from attempting to connect to the DB during build time
export const dynamic = "force-dynamic";

const prisma = new PrismaClient();

function isHexAddress(a: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(a);
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params;

  if (!address || !isHexAddress(address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  try {
    // Normalize to checksum format to match how the indexer stores addresses
    const normalizedAddr = getAddress(address);

    const trades = await prisma.trade.findMany({
      where: {
        trader: normalizedAddr,
      },
      select: {
        isBuy: true,
        tokensDelta: true,
        sharesDelta: true,
        marketId: true,
        modelIdx: true,
        blockTime: true,
      },
      orderBy: { blockTime: "desc" },
    });

    const totalTrades = trades.length;

    let totalTokens = 0n;
    let buyTokens = 0n;
    let sellTokens = 0n;

    let totalShares = 0n;
    let buyShares = 0n;
    let sellShares = 0n;

    const markets = new Map<string, bigint>();
    const models = new Map<string, bigint>();

    let firstSeen: Date | null = null;
    let lastSeen: Date | null = null;

    for (const t of trades) {
      const tok = BigInt(t.tokensDelta.toString());
      const sh = BigInt(t.sharesDelta.toString());

      totalTokens += tok;
      totalShares += sh;

      if (t.isBuy) {
        buyTokens += tok;
        buyShares += sh;
      } else {
        sellTokens += tok;
        sellShares += sh;
      }

      const mKey = t.marketId.toString();
      markets.set(mKey, (markets.get(mKey) ?? 0n) + tok);

      const mmKey = `${t.marketId.toString()}:${t.modelIdx.toString()}`;
      models.set(mmKey, (models.get(mmKey) ?? 0n) + tok);

      if (!lastSeen) lastSeen = t.blockTime;
      firstSeen = t.blockTime;
    }

    const topMarkets = [...markets.entries()]
      .sort((a, b) => (b[1] > a[1] ? 1 : -1))
      .slice(0, 10)
      .map(([marketId, vol]) => ({ marketId, volumeTokens: vol.toString() }));

    const topModels = [...models.entries()]
      .sort((a, b) => (b[1] > a[1] ? 1 : -1))
      .slice(0, 10)
      .map(([key, vol]) => {
        const [marketId, modelIdx] = key.split(":");
        return { marketId, modelIdx, volumeTokens: vol.toString() };
      });

    const netTokensProxy = buyTokens - sellTokens;

    return NextResponse.json({
      address: normalizedAddr,
      totalTrades,
      totalTokens: totalTokens.toString(),
      buyTokens: buyTokens.toString(),
      sellTokens: sellTokens.toString(),
      netTokensProxy: netTokensProxy.toString(),
      totalShares: totalShares.toString(),
      buyShares: buyShares.toString(),
      sellShares: sellShares.toString(),
      firstSeen,
      lastSeen,
      topMarkets,
      topModels,
    });
  } catch (error) {
    console.error("Database error in stats route:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
