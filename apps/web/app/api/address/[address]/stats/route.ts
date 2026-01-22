import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function isHexAddress(a: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(a);
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params;

  if (!isHexAddress(address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  // Normalize to the same format stored in DB (if you stored checksummed)
  // If you always stored checksummed via viem getAddress(), you should do same here.
  // For now, accept exact match + lowercase fallback.
  const addr = address;

  const trades = await prisma.trade.findMany({
    where: {
      OR: [{ trader: addr }, { trader: addr.toLowerCase() }],
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

  const markets = new Map<string, bigint>(); // marketId -> token volume
  const models = new Map<string, bigint>();  // `${marketId}:${modelIdx}` -> token volume

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

  // top markets
  const topMarkets = [...markets.entries()]
    .sort((a, b) => (b[1] > a[1] ? 1 : -1))
    .slice(0, 10)
    .map(([marketId, vol]) => ({ marketId, volumeTokens: vol.toString() }));

  // top models
  const topModels = [...models.entries()]
    .sort((a, b) => (b[1] > a[1] ? 1 : -1))
    .slice(0, 10)
    .map(([key, vol]) => {
      const [marketId, modelIdx] = key.split(":");
      return { marketId, modelIdx, volumeTokens: vol.toString() };
    });

  // Net flow proxy (buy - sell)
  const netTokensProxy = buyTokens - sellTokens;

  return NextResponse.json({
    address: addr,
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
}
