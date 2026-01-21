import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function isHexAddress(a: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(a);
}

export async function GET(req: Request, { params }: { params: { address: string } }) {
  const address = params.address;
  if (!isHexAddress(address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  const url = new URL(req.url);
  const take = Math.min(Number(url.searchParams.get("take") ?? 50), 200);
  const skip = Number(url.searchParams.get("skip") ?? 0);

  const rows = await prisma.trade.findMany({
    where: { OR: [{ trader: address }, { trader: address.toLowerCase() }] },
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

  // Add implied % derived from UD60x18 price
  const trades = rows.map((r) => {
    const priceRaw = BigInt(r.modelNewPrice.toString());
    const impliedPct = Number(priceRaw) / 1e16; // (price/1e18)*100
    return { ...r, impliedPct };
  });

  return NextResponse.json({ address, take, skip, trades });
}
