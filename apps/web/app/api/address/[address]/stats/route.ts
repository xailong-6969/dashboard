import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAddress } from "viem";

export const dynamic = "force-dynamic";

function isHexAddress(a: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(a);
}

interface TradeData {
  isBuy: boolean;
  tokensDelta: string;
  sharesDelta: string;
  marketId: bigint;
  modelIdx: bigint;
  blockTime: Date;
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
    const normalizedAddr = getAddress(address);

    const trades = await prisma.trade.findMany({
      where: { trader: normalizedAddr },
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

    for (const t of trades as TradeData[]) {
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
      totalShares: totalShares.toString(),
      buyShares: buyShares.toString(),
      sellShares: sellShares.toString(),
      netTokensProxy: netTokensProxy.toString(),
      topMarkets,
      topModels,
      firstSeen,
      lastSeen,
    });
  } catch (e) {
    console.error("Stats API error:", e);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
