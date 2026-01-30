import { createPublicClient, http, parseAbiItem, getAddress, type Log } from "viem";
import { PrismaClient } from "@prisma/client";

// ============================================
// CONFIGURATION
// ============================================
export const DELPHI_PROXY = "0x3B5629d3a10C13B51F3DC7d5125A5abe5C20FaF1" as const;
export const DELPHI_IMPL = "0xCaC4F41DF8188034Eb459Bb4c8FaEcd6EE369fdf" as const;
export const CHAIN_ID = 685685;
export const CHAIN_NAME = "Gensyn Testnet";

const CONTRACT_ADDRESS = DELPHI_PROXY;
const BATCH_SIZE = 50;
const CONFIRMATIONS = 2n;

// ============================================
// EVENT SIGNATURES
// ============================================
const EVENT_NEW_MARKET = parseAbiItem(
  "event NewMarket(uint128 indexed newMarketId, string newMarketConfigUri, bytes32 newMarketConfigUriHash)"
);

const EVENT_TRADE_EXECUTED = parseAbiItem(
  "event TradeExecuted(uint128 marketId, uint128 allowedModelIdx, address trader, bool isBuy, uint256 tokensDelta, uint256 modelSharesDelta, uint256 modelNewPrice, uint256 modelNewSupply, uint256 marketNewSupply)"
);

const EVENT_WINNERS = parseAbiItem(
  "event WinnersSubmitted(uint128 indexed marketId, uint128 winningModelIdx)"
);

// ============================================
// RPC CLIENT - No caching to always get fresh block numbers
// ============================================
function getClient() {
  const rpcUrl = process.env.RPC_URL;
  if (!rpcUrl) throw new Error("Missing RPC_URL");

  return createPublicClient({
    transport: http(rpcUrl, {
      retryCount: 3,
      retryDelay: 1000,
      timeout: 30000,
      batch: false, // Disable batching to avoid stale responses
    }),
    batch: {
      multicall: false, // Disable multicall batching
    },
    cacheTime: 0, // Disable caching
  });
}

// ============================================
// HELPERS
// ============================================
function toDate(tsSeconds: bigint): Date {
  return new Date(Number(tsSeconds) * 1000);
}

function priceToPercent(price: bigint): number {
  return Number(price) / 1e16;
}

// ============================================
// FETCH MARKET CONFIG FROM IPFS
// ============================================
async function fetchMarketConfig(configUri: string): Promise<{
  title?: string;
  description?: string;
  category?: string;
  models?: Array<{ idx: number; familyName: string; modelName: string }>;
} | null> {
  if (!configUri) return null;

  try {
    let url = configUri;

    if (configUri.startsWith("ipfs://")) {
      const hash = configUri.slice(7);
      const gateways = [
        `https://ipfs.io/ipfs/${hash}`,
        `https://cloudflare-ipfs.com/ipfs/${hash}`,
        `https://gateway.pinata.cloud/ipfs/${hash}`,
      ];

      for (const gateway of gateways) {
        try {
          const response = await fetch(gateway, {
            signal: AbortSignal.timeout(5000),
            headers: { 'Accept': 'application/json' },
          });
          if (response.ok) {
            const data = await response.json();
            return {
              title: data.title || data.name,
              description: data.description,
              category: data.category,
              models: data.models || data.entries || data.options,
            };
          }
        } catch {
          continue;
        }
      }
    } else if (configUri.startsWith("http")) {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(5000),
        headers: { 'Accept': 'application/json' },
      });
      if (response.ok) {
        const data = await response.json();
        return {
          title: data.title || data.name,
          description: data.description,
          category: data.category,
          models: data.models || data.entries || data.options,
        };
      }
    }
  } catch (e) {
    console.log(`⚠️ Could not fetch config: ${configUri}`);
  }

  return null;
}

// ============================================
// EVENT HANDLERS
// ============================================
async function handleNewMarket(prisma: PrismaClient, log: Log, blockTime: Date) {
  const args = (log as any).args;
  const marketId = BigInt(args.newMarketId.toString());
  const configUri = args.newMarketConfigUri as string;
  const configUriHash = args.newMarketConfigUriHash as string;

  const config = await fetchMarketConfig(configUri);

  let modelsJson: string | undefined;
  if (config?.models && config.models.length > 0) {
    modelsJson = JSON.stringify(config.models);
  }

  await prisma.market.upsert({
    where: { marketId },
    update: { configUri, configUriHash, title: config?.title, description: config?.description, modelsJson },
    create: { marketId, configUri, configUriHash, createdAtBlock: BigInt(log.blockNumber!.toString()), createdAtTime: blockTime, title: config?.title, description: config?.description, modelsJson, status: 0 },
  });
}

// FIXED: Better duplicate handling - check if trade exists first
async function handleTradeExecuted(prisma: PrismaClient, log: Log, blockTime: Date): Promise<boolean> {
  const args = (log as any).args;
  const { marketId, allowedModelIdx, trader, isBuy, tokensDelta, modelSharesDelta, modelNewPrice, modelNewSupply, marketNewSupply } = args;

  const id = `${log.transactionHash}:${log.logIndex}`;
  const mktId = BigInt(marketId.toString());

  // Check if trade already exists
  const existing = await prisma.trade.findUnique({ where: { id } });
  if (existing) {
    // Trade already indexed, skip silently
    return false;
  }

  // Ensure market exists
  await prisma.market.upsert({
    where: { marketId: mktId },
    update: {},
    create: { marketId: mktId, status: 0 }
  });

  // Create the trade
  try {
    await prisma.trade.create({
      data: {
        id,
        txHash: log.transactionHash!,
        logIndex: Number(log.logIndex),
        blockNumber: BigInt(log.blockNumber!.toString()),
        blockTime,
        marketId: mktId,
        modelIdx: BigInt(allowedModelIdx.toString()),
        trader: getAddress(trader),
        isBuy: Boolean(isBuy),
        tokensDelta: tokensDelta.toString(),
        sharesDelta: modelSharesDelta.toString(),
        modelNewPrice: modelNewPrice.toString(),
        modelNewSupply: modelNewSupply.toString(),
        marketNewSupply: marketNewSupply.toString(),
        impliedProbability: priceToPercent(BigInt(modelNewPrice.toString())),
      },
    });
    return true;
  } catch (e: any) {
    // Handle duplicate key error gracefully (shouldn't happen now, but just in case)
    if (e.code === 'P2002') {
      return false;
    }
    // Re-throw any other error
    throw e;
  }
}

async function handleWinnersSubmitted(prisma: PrismaClient, log: Log, blockTime: Date) {
  const args = (log as any).args;
  const marketId = BigInt(args.marketId.toString());
  const winningModelIdx = BigInt(args.winningModelIdx.toString());

  await prisma.market.upsert({
    where: { marketId },
    update: { winningModelIdx, status: 2, settledAt: blockTime },
    create: { marketId, winningModelIdx, status: 2, settledAt: blockTime },
  });
}

// ============================================
// MAIN INDEXER - FIXED
// ============================================
export async function runIndexer(
  prisma: PrismaClient,
  options: { fromBlock?: bigint; toBlock?: bigint; batchSize?: number; onProgress?: (current: bigint, target: bigint) => void } = {}
): Promise<{ indexed: number; lastBlock: bigint }> {
  if (!prisma) throw new Error("PrismaClient is required by runIndexer");

  const client = getClient();
  const batchSize = BigInt(options.batchSize || BATCH_SIZE);

  // Use direct RPC call to bypass any viem caching
  let headBlock: bigint;
  try {
    const rpcUrl = process.env.RPC_URL;
    const response = await fetch(rpcUrl!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_blockNumber',
        params: [],
        id: Date.now()
      })
    });
    const json = await response.json();
    headBlock = BigInt(json.result);
    console.log(`📡 Direct RPC block number: ${headBlock}`);
  } catch (e) {
    console.log('⚠️ Direct RPC failed, falling back to viem');
    headBlock = await client.getBlockNumber();
  }

  const targetBlock = options.toBlock ?? (headBlock - CONFIRMATIONS);

  let fromBlock: bigint;
  if (options.fromBlock !== undefined) {
    fromBlock = options.fromBlock;
  } else {
    const state = await prisma.indexerState.findUnique({ where: { id: "delphi" } });
    fromBlock = (state && state.lastBlock && state.lastBlock > 0n)
      ? BigInt(state.lastBlock.toString()) + 1n
      : 9000000n;
  }

  // If already caught up, return immediately
  if (fromBlock > targetBlock) {
    console.log(`✅ Already caught up (fromBlock ${fromBlock} > targetBlock ${targetBlock})`);
    return { indexed: 0, lastBlock: fromBlock - 1n };
  }

  let totalIndexed = 0;
  let currentBlock = fromBlock;
  const blockTimestampCache = new Map<bigint, Date>();

  const getBlockTime = async (blockNumber: bigint): Promise<Date> => {
    const cached = blockTimestampCache.get(blockNumber);
    if (cached) return cached;
    try {
      const block = await client.getBlock({ blockNumber });
      const time = toDate(block.timestamp);
      blockTimestampCache.set(blockNumber, time);
      return time;
    } catch { return new Date(); }
  };

  console.log(`📦 Indexing from block ${fromBlock} to ${targetBlock}`);

  while (currentBlock <= targetBlock) {
    const endBlock = currentBlock + batchSize - 1n > targetBlock ? targetBlock : currentBlock + batchSize - 1n;

    if (options.onProgress) {
      options.onProgress(currentBlock, targetBlock);
    }

    const logs = await client.getLogs({
      address: CONTRACT_ADDRESS,
      fromBlock: currentBlock,
      toBlock: endBlock,
      events: [EVENT_NEW_MARKET, EVENT_TRADE_EXECUTED, EVENT_WINNERS],
    });

    // Process logs
    let batchIndexed = 0;
    for (const log of logs) {
      const blockTime = await getBlockTime(log.blockNumber!);
      switch (log.eventName) {
        case "NewMarket":
          await handleNewMarket(prisma, log, blockTime);
          break;
        case "TradeExecuted":
          if (await handleTradeExecuted(prisma, log, blockTime)) {
            batchIndexed++;
          }
          break;
        case "WinnersSubmitted":
          await handleWinnersSubmitted(prisma, log, blockTime);
          break;
      }
    }

    totalIndexed += batchIndexed;

    // Update indexer state after each batch
    await prisma.indexerState.upsert({
      where: { id: "delphi" },
      update: { lastBlock: endBlock, updatedAt: new Date(), isRunning: false },
      create: { id: "delphi", lastBlock: endBlock, isRunning: false },
    });

    if (batchIndexed > 0) {
      console.log(`  Block ${currentBlock}-${endBlock}: +${batchIndexed} trades`);
    }

    currentBlock = endBlock + 1n;
    if (blockTimestampCache.size > 500) blockTimestampCache.clear();
  }

  console.log(`✅ Indexing complete: ${totalIndexed} new trades indexed`);
  return { indexed: totalIndexed, lastBlock: targetBlock };
}

// ============================================
// RECALCULATE STATS
// ============================================
export async function recalculateTraderStats(prisma: PrismaClient): Promise<number> {
  const settledMarkets = await prisma.market.findMany({ where: { status: 2, winningModelIdx: { not: null } } });
  const winningModels = new Map(settledMarkets.map(m => [m.marketId.toString(), m.winningModelIdx!]));
  const traders = await prisma.trade.findMany({ distinct: ['trader'], select: { trader: true } });
  let updated = 0;

  for (const { trader } of traders) {
    const trades = await prisma.trade.findMany({ where: { trader }, orderBy: { blockTime: 'asc' } });
    let totalVolume = 0n, buyCount = 0, sellCount = 0, totalSpent = 0n, totalReceived = 0n;
    const positions = new Map<string, { shares: bigint; cost: bigint }>();

    for (const trade of trades) {
      const tokens = BigInt(trade.tokensDelta), shares = BigInt(trade.sharesDelta);
      const absTokens = tokens < 0n ? -tokens : tokens;
      totalVolume += absTokens;
      const key = `${trade.marketId}:${trade.modelIdx}`;

      if (trade.isBuy) {
        buyCount++; totalSpent += absTokens;
        const pos = positions.get(key) || { shares: 0n, cost: 0n };
        pos.shares += shares; pos.cost += absTokens;
        positions.set(key, pos);
      } else {
        sellCount++; totalReceived += absTokens;
        const pos = positions.get(key);
        if (pos && pos.shares > 0n) { pos.shares -= (shares > pos.shares ? pos.shares : shares); positions.set(key, pos); }
      }
    }

    let settlementPayout = 0n;
    for (const [key, pos] of positions.entries()) {
      const [marketIdStr, modelIdxStr] = key.split(':');
      if (winningModels.get(marketIdStr)?.toString() === modelIdxStr) settlementPayout += pos.shares;
    }

    await prisma.traderStats.upsert({
      where: { address: trader },
      update: { totalTrades: trades.length, totalVolume: totalVolume.toString(), buyCount, sellCount, realizedPnl: (totalReceived + settlementPayout - totalSpent).toString(), totalCostBasis: totalSpent.toString(), lastTradeAt: trades[trades.length - 1]?.blockTime },
      create: { address: trader, totalTrades: trades.length, totalVolume: totalVolume.toString(), buyCount, sellCount, realizedPnl: (totalReceived + settlementPayout - totalSpent).toString(), totalCostBasis: totalSpent.toString(), firstTradeAt: trades[0]?.blockTime, lastTradeAt: trades[trades.length - 1]?.blockTime },
    });
    updated++;
  }
  return updated;
}

export async function updateMarketVolumes(prisma: PrismaClient): Promise<void> {
  const markets = await prisma.market.findMany({ select: { marketId: true } });
  for (const { marketId } of markets) {
    const trades = await prisma.trade.findMany({ where: { marketId }, select: { tokensDelta: true } });
    const totalVolume = trades.reduce((acc, t) => acc + (BigInt(t.tokensDelta) < 0n ? -BigInt(t.tokensDelta) : BigInt(t.tokensDelta)), 0n);
    await prisma.market.update({ where: { marketId }, data: { totalVolume: totalVolume.toString(), totalTrades: trades.length } });
  }
}

export function getModelName(marketId: number | bigint, modelIdx: number | bigint): string {
  return `Model ${modelIdx}`;
}
