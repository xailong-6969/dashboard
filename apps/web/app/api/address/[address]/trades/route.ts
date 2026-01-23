import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getAddress } from "viem";

// REQUIRED for Railway Build
export const dynamic = "force-dynamic";

const prisma = new PrismaClient();

function isHexAddress(a: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(a);
}

export async function GET(req: Request, { params }: { params: Promise<{ address: string }> }) {
  const { address: rawAddress } = await params;
  if (!isHexAddress(rawAddress)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  // Normalize to checksum format used by the indexer
  const address = getAddress(rawAddress);

  const url = new URL(req.url);
  const take = Math.min(Number(url.searchParams.get("take") ?? 50), 200);
  const skip = Number(url.searchParams.get("skip") ?? 0);

  const rows = await prisma.trade.findMany({
    where: { trader: address },
    orderBy: [{ blockTime: "desc" }],
    take,
    skip,
    select: {
      txHash: true,
      blockTime: true,
      marketId: true,
      modelIdx: true,
      isBuy: true,
      tokensDelta: true,
      sharesDelta: true,
      modelNewPrice: true,
    },
  });

  const trades = rows.map((r) => {
    const priceRaw = BigInt(r.modelNewPrice.toString());
    const impliedPct = Number(priceRaw) / 1e16; 
    return { ...r, impliedPct };
  });

  return NextResponse.json({ address, take, skip, trades });
}
