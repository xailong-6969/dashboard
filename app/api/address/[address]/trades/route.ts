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
  req: Request,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address: rawAddress } = await params;

  if (!rawAddress || !isHexAddress(rawAddress)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  try {
    const address = getAddress(rawAddress);
    const url = new URL(req.url);
    const take = Math.min(Number(url.searchParams.get("take") || 50), 200);
    const skip = Number(url.searchParams.get("skip") || 0);
    const marketId = url.searchParams.get("marketId");

    const where: any = { trader: address };
    if (marketId) {
      where.marketId = BigInt(marketId);
    }

    const [trades, total] = await Promise.all([
      prisma.trade.findMany({
        where,
        orderBy: { blockTime: "desc" },
        take,
        skip,
        select: {
          id: true,
          txHash: true,
          blockTime: true,
          marketId: true,
          modelIdx: true,
          isBuy: true,
          tokensDelta: true,
          sharesDelta: true,
          modelNewPrice: true,
          impliedProbability: true,
          market: {
            select: {
              title: true,
              modelsJson: true,
            },
          },
        },
      }),
      prisma.trade.count({ where }),
    ]);

    return NextResponse.json({
      address,
      trades: trades.map((t) => ({
        id: t.id,
        txHash: t.txHash,
        blockTime: t.blockTime,
        marketId: t.marketId.toString(),
        marketTitle: t.market?.title,
        modelIdx: t.modelIdx.toString(),
        isBuy: t.isBuy,
        tokensDelta: t.tokensDelta,
        sharesDelta: t.sharesDelta,
        modelNewPrice: t.modelNewPrice,
        impliedProbability: t.impliedProbability,
      })),
      total,
      take,
      skip,
    });
  } catch (e) {
    console.error("Address trades error:", e);
    return NextResponse.json({ error: "Failed to fetch trades" }, { status: 500 });
  }
}
