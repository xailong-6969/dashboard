import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { createPublicClient, http, getAddress } from "viem";
import delphiAbi from "@/lib/delphi.abi.json";

const prisma = new PrismaClient();

const RPC_URL = process.env.RPC_URL!;
const DELPHI_IMPL = (process.env.DELPHI_IMPL ??
  "0xCaC4F41Df8188034Eb459Bb4c8FaEcd6EE369fdf") as `0x${string}`;

if (!RPC_URL) throw new Error("Missing RPC_URL");

const client = createPublicClient({
  transport: http(RPC_URL),
});

function isHexAddress(a: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(a);
}

type PositionKey = string;

type Position = {
  marketId: bigint;
  modelIdx: bigint;
  sharesHeld: bigint;
  costBasis: bigint;
  realizedPnl: bigint;
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address: rawAddress } = await params;
  const raw = rawAddress?.trim();
  
  if (!raw || !isHexAddress(raw)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  const address = getAddress(raw);

  const trades = await prisma.trade.findMany({
    where: {
      OR: [{ trader: address }, { trader: address.toLowerCase() }],
    },
    orderBy: { blockTime: "asc" },
    select: {
      marketId: true,
      modelIdx: true,
      isBuy: true,
      tokensDelta: true,
      sharesDelta: true,
      blockTime: true,
      txHash: true,
    },
  });

  const positions = new Map<PositionKey, Position>();

  const getPos = (marketId: bigint, modelIdx: bigint) => {
    const key = `${marketId.toString()}:${modelIdx.toString()}`;
    let p = positions.get(key);
    if (!p) {
      p = { marketId, modelIdx, sharesHeld: 0n, costBasis: 0n, realizedPnl: 0n };
      positions.set(key, p);
    }
    return p;
  };

  for (const t of trades) {
    const marketId = BigInt(t.marketId.toString());
    const modelIdx = BigInt(t.modelIdx.toString());
    // ✅ FIXED: tokensDelta and sharesDelta are already strings
    const tokens = BigInt(t.tokensDelta);
    const shares = BigInt(t.sharesDelta);

    const p = getPos(marketId, modelIdx);

    if (t.isBuy) {
      p.sharesHeld += shares;
      p.costBasis += tokens;
    } else {
      if (p.sharesHeld === 0n) {
        p.realizedPnl += tokens;
        continue;
      }

      const avgCostPerShare = p.costBasis / p.sharesHeld;
      const costRemoved = avgCostPerShare * shares;
      const proceeds = tokens;
      p.realizedPnl += proceeds - costRemoved;
      p.sharesHeld -= shares;
      p.costBasis = p.costBasis > costRemoved ? (p.costBasis - costRemoved) : 0n;
    }
  }

  const openPositions = [...positions.values()].filter((p) => p.sharesHeld > 0n);

  const MAX_QUOTES = 20;
  openPositions.sort((a, b) => (b.costBasis > a.costBasis ? 1 : -1));
  const quoted = openPositions.slice(0, MAX_QUOTES);
  const unquoted = openPositions.slice(MAX_QUOTES);

  const quoteResults: Array<{
    marketId: string;
    modelIdx: string;
    sharesHeld: string;
    costBasis: string;
    exitValue: string;
    unrealizedPnl: string;
  }> = [];

  let totalRealized = 0n;
  let totalUnrealized = 0n;
  let totalCostBasis = 0n;
  let totalExitValue = 0n;

  for (const p of positions.values()) totalRealized += p.realizedPnl;

  for (const p of quoted) {
    totalCostBasis += p.costBasis;

    const exitValue = (await client.readContract({
      address: DELPHI_IMPL,
      abi: delphiAbi,
      functionName: "quoteSellExactIn",
      args: [p.marketId, p.modelIdx, p.sharesHeld],
    })) as bigint;

    const unrealized = exitValue - p.costBasis;
    totalExitValue += exitValue;
    totalUnrealized += unrealized;

    quoteResults.push({
      marketId: p.marketId.toString(),
      modelIdx: p.modelIdx.toString(),
      sharesHeld: p.sharesHeld.toString(),
      costBasis: p.costBasis.toString(),
      exitValue: exitValue.toString(),
      unrealizedPnl: unrealized.toString(),
    });
  }

  const estimateResults: typeof quoteResults = [];
  for (const p of unquoted) {
    totalCostBasis += p.costBasis;

    const spot = (await client.readContract({
      address: DELPHI_IMPL,
      abi: delphiAbi,
      functionName: "spotPrice",
      args: [p.marketId, p.modelIdx],
    })) as bigint;

    const exitEst = (p.sharesHeld * spot) / 1_000_000_000_000_000_000n;
    const unrealizedEst = exitEst - p.costBasis;

    totalExitValue += exitEst;
    totalUnrealized += unrealizedEst;

    estimateResults.push({
      marketId: p.marketId.toString(),
      modelIdx: p.modelIdx.toString(),
      sharesHeld: p.sharesHeld.toString(),
      costBasis: p.costBasis.toString(),
      exitValue: exitEst.toString(),
      unrealizedPnl: unrealizedEst.toString(),
    });
  }

  const totalPnl = totalRealized + totalUnrealized;

  return NextResponse.json({
    address,
    totals: {
      realizedPnl: totalRealized.toString(),
      unrealizedPnl: totalUnrealized.toString(),
      totalPnl: totalPnl.toString(),
      costBasisOpen: totalCostBasis.toString(),
      exitValueOpen: totalExitValue.toString(),
      openPositions: openPositions.length,
      quotedPositions: quoted.length,
      estimatedPositions: unquoted.length,
    },
    positions: {
      quoted: quoteResults,
      estimated: estimateResults,
    },
    notes: [
      "Realized PnL uses average-cost accounting per market/model.",
      "Unrealized PnL uses on-chain exit quotes for top positions and spotPrice estimates for the rest.",
      "Values are in the market token units (e.g., $TEST) and are testnet-only.",
    ],
  });
}
