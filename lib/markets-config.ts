// Market Configuration

export interface MarketConfig {
  internalId: string;
  displayId: string;
  title: string;
  status: "active" | "settled";
  winnerIdx?: number;
  endDate: string;           // Display format like "Jan 30"
  endTimestamp?: string;     // ISO timestamp for countdown: "2026-01-30T17:40:00Z"
  models: Array<{
    idx: number;
    name: string;
    family: string;
  }>;
}

// All market configurations
export const MARKETS: Record<string, MarketConfig> = {
  "0": {
    internalId: "0",
    displayId: "1",
    title: "Gensyn Middleweight General Reasoning Benchmark",
    status: "settled",
    winnerIdx: 0,
    endDate: "Dec 31",
    models: [
      { idx: 0, name: "QWEN/QWEN3-30B-A3B-INSTRUCT-2507", family: "QWEN" },
      { idx: 1, name: "OPENAI/GPT-OSS-20B", family: "OPENAI" },
      { idx: 2, name: "GOOGLE/GEMMA-3-27B-IT", family: "GOOGLE" },
      { idx: 3, name: "ZAI-ORG/GLM-4-32B-0414", family: "ZAI-ORG" },
      { idx: 4, name: "TIIUAE/FALCON-H1-34B-INSTRUCT", family: "TIIUAE" },
    ],
  },
  "1": {
    internalId: "1",
    displayId: "2",
    title: "Gensyn Middleweight General Reasoning Benchmark (II)",
    status: "settled",
    winnerIdx: 0,
    endDate: "Dec 30",
    models: [
      { idx: 0, name: "QWEN/QWEN3-30B-A3B-INSTRUCT-2507", family: "QWEN" },
      { idx: 1, name: "OPENAI/GPT-OSS-20B", family: "OPENAI" },
      { idx: 2, name: "GOOGLE/GEMMA-3-27B-IT", family: "GOOGLE" },
      { idx: 3, name: "ZAI-ORG/GLM-4-32B-0414", family: "ZAI-ORG" },
      { idx: 4, name: "TIIUAE/FALCON-H1-34B-INSTRUCT", family: "TIIUAE" },
    ],
  },
  "3": {
    internalId: "3",
    displayId: "3",
    title: "Gensyn Lightweight General Reasoning Benchmark",
    status: "active",
    endDate: "Jan 30",
    endTimestamp: "2026-01-30T17:40:00Z",  // Jan 30, 2026 5:40 PM UTC = 11:10 PM IST
    models: [
      { idx: 0, name: "QWEN/QWEN3-8B", family: "QWEN" },
      { idx: 1, name: "MISTRALAI/MINISTRAL-3B-2412", family: "MISTRALAI" },
      { idx: 2, name: "IBM-GRANITE/GRANITE-4.0-TINY-PREVIEW", family: "IBM-GRANITE" },
      { idx: 3, name: "ALLENAI/OLMO-3-7B-INSTRUCT", family: "ALLENAI" },
      { idx: 4, name: "META-LLAMA/LLAMA-3.1-8B-INSTRUCT", family: "META-LLAMA" },
    ],
  },
};

// Valid internal market IDs
export const VALID_MARKET_IDS = ["0", "1", "3"];
export const VALID_MARKET_IDS_BIGINT = [0n, 1n, 3n];

// Get market config by internal ID
export function getMarketConfig(internalId: string): MarketConfig | null {
  return MARKETS[internalId] || null;
}

// Get market config by display ID
export function getMarketByDisplayId(displayId: string): MarketConfig | null {
  for (const market of Object.values(MARKETS)) {
    if (market.displayId === displayId) {
      return market;
    }
  }
  return null;
}

// Get model name by market and model index
export function getModelName(marketId: string, modelIdx: number): string {
  const market = MARKETS[marketId];
  if (!market) return `Model ${modelIdx}`;
  const model = market.models.find(m => m.idx === modelIdx);
  return model?.name || `Model ${modelIdx}`;
}

// Winners for P&L calculation
export const MARKET_WINNERS: Record<string, number> = {
  "0": 0,
  "1": 0,
};

// Check if a market has ended based on endTimestamp
export function hasMarketEnded(marketId: string): boolean {
  const market = MARKETS[marketId];
  if (!market) return false;

  // If already settled, it's ended
  if (market.status === "settled") return true;

  // If has endTimestamp, check if current time is past it
  if (market.endTimestamp) {
    return new Date() > new Date(market.endTimestamp);
  }

  return false;
}

// Get effective status (considering endTimestamp)
export function getEffectiveStatus(marketId: string): "active" | "ended" | "settled" {
  const market = MARKETS[marketId];
  if (!market) return "active";

  if (market.status === "settled") return "settled";

  if (market.endTimestamp && new Date() > new Date(market.endTimestamp)) {
    return "ended";  // Timer expired but not yet settled (winner not announced)
  }

  return "active";
}
