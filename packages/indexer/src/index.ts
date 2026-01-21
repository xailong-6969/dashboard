import "dotenv/config";
import { createPublicClient, http, parseAbiItem, getAddress } from "viem";
import { mainnet } from "viem/chains"; // chain object not critical if you pass RPC
import { PrismaClient } from "@prisma/client";
import { DELPHI_IMPL } from "@delphi-pulse/contracts/delphi";

const prisma = new PrismaClient();

const RPC_URL = process.env.RPC_URL!;
if (!RPC_URL) throw new Error("Missing RPC_URL");

const client = createPublicClient({
  chain: mainnet, // placeholder; viem mainly needs RPC
  transport: http(RPC_URL),
});

const EVENT_NEW_MARKET = parseAbiItem(
  "event NewMarket(uint128 indexed newMarketId, string newMarketConfigUri, bytes32 newMarketConfigUriHash)"
);

const EVENT_TRADE_EXECUTED = parseAbiItem(
  "event TradeExecuted(uint128 marketId, uint128 allowedModelIdx, address trader, bool isBuy, uint256 tokensDelta, uint256 modelSharesDelta, uint256 modelNewPrice, uint256 modelNewSupply, uint256 marketNewSupply)"
);

const EVENT_WINNERS = parseAbiItem(
  "event WinnersSubmitted(uint128 indexed marketId, uint128 winningModelIdx)"
);

const BATCH_BLOCKS = BigInt(process.env.BATCH_BLOCKS ?? "2000");
const CONFIRMATIONS = BigInt(process.env.CONFIRMATIONS ?? "0"); // testnet ok

async function getLastIndexedBlock(): Promise<bigint> {
  const state = await prisma.indexerState.findUnique({ where: { id: "delphi" } });
  if (!state) {
    // start a little behind head to avoid missing reorgs if any
    const head = await client.getBlockNumber();
    const start = head > 10_000n ? head - 10_000n : 0n;
    await prisma.indexerState.create({ data: { id: "delphi", lastBlock: start } });
    return start;
  }
  return BigInt(state.lastBlock.toString());
}

async function setLastIndexedBlock(block: bigint) {
  await prisma.indexerState.upsert({
    where: { id: "delphi" },
    update: { lastBlock: block },
    create: { id: "delphi", lastBlock: block },
  });
}

function toDate(tsSeconds: bigint) {
  return new Date(Number(tsSeconds) * 1000);
}

async function upsertMarketFromNewMarketLog(log: any, blockTime: Date) {
  const marketId = log.args.newMarketId as bigint;
  const uri = log.args.newMarketConfigUri as string;
  const uriHash = log.args.newMarketConfigUriHash as `0x${string}`;

  await prisma.market.upsert({
    where: { marketId: BigInt(marketId.toString()) },
    update: {
      configUri: uri,
      configUriHash: uriHash,
    },
    create: {
      marketId: BigInt(marketId.toString()),
      configUri: uri,
      configUriHash: uriHash,
      createdAtBlock: BigInt(log.blockNumber.toString()),
      createdAtTime: blockTime,
    },
  });
}

async function insertTradeFromTradeLog(log: any, blockTime: Date) {
  const {
    marketId,
    allowedModelIdx,
    trader,
    isBuy,
    tokensDelta,
    modelSharesDelta,
    modelNewPrice,
    modelNewSupply,
    marketNewSupply,
  } = log.args;

  const id = `${log.transactionHash}:${log.logIndex}`;

  // Ensure Market row exists
  await prisma.market.upsert({
    where: { marketId: BigInt((marketId as bigint).toString()) },
    update: {},
    create: { marketId: BigInt((marketId as bigint).toString()) },
  });

  await prisma.trade.upsert({
    where: { id },
    update: {}, // immutable event
    create: {
      id,
      txHash: log.transactionHash,
      logIndex: Number(log.logIndex),
      blockNumber: BigInt(log.blockNumber.toString()),
      blockTime,

      marketId: BigInt((marketId as bigint).toString()),
      modelIdx: BigInt((allowedModelIdx as bigint).toString()),
      trader: getAddress(trader as string),
      isBuy: Boolean(isBuy),

      tokensDelta: (tokensDelta as bigint).toString(),
      sharesDelta: (modelSharesDelta as bigint).toString(),

      modelNewPrice: (modelNewPrice as bigint).toString(),
      modelNewSupply: (modelNewSupply as bigint).toString(),
      marketNewSupply: (marketNewSupply as bigint).toString(),
    },
  });
}

async function applyWinner(log: any) {
  const marketId = log.args.marketId as bigint;
  const winningModelIdx = log.args.winningModelIdx as bigint;

  await prisma.market.upsert({
    where: { marketId: BigInt(marketId.toString()) },
    update: { winningModelIdx: BigInt(winningModelIdx.toString()) },
    create: { marketId: BigInt(marketId.toString()), winningModelIdx: BigInt(winningModelIdx.toString()) },
  });
}

async function indexRange(fromBlock: bigint, toBlock: bigint) {
  // get block times for boundaries; per-log timestamps need per-block lookup
  // optimization: cache block timestamps by blockNumber within this batch
  const blockTsCache = new Map<bigint, Date>();

  const getBlockTime = async (bn: bigint) => {
    const cached = blockTsCache.get(bn);
    if (cached) return cached;
    const b = await client.getBlock({ blockNumber: bn });
    const t = toDate(b.timestamp);
    blockTsCache.set(bn, t);
    return t;
  };

  const logs = await client.getLogs({
    address: DELPHI_IMPL,
    fromBlock,
    toBlock,
    events: [EVENT_NEW_MARKET, EVENT_TRADE_EXECUTED, EVENT_WINNERS],
  });

  for (const log of logs) {
    const blockTime = await getBlockTime(log.blockNumber);

    if (log.eventName === "NewMarket") {
      await upsertMarketFromNewMarketLog(log, blockTime);
    } else if (log.eventName === "TradeExecuted") {
      await insertTradeFromTradeLog(log, blockTime);
    } else if (log.eventName === "WinnersSubmitted") {
      await applyWinner(log);
    }
  }
}

async function main() {
  const head = await client.getBlockNumber();
  const targetHead = head - CONFIRMATIONS;

  let last = await getLastIndexedBlock();
  let from = last + 1n;

  while (from <= targetHead) {
    const to = (from + BATCH_BLOCKS - 1n) > targetHead ? targetHead : (from + BATCH_BLOCKS - 1n);
    await indexRange(from, to);
    await setLastIndexedBlock(to);
    from = to + 1n;
    console.log(`Indexed blocks ${from - BATCH_BLOCKS}..${to}`);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
