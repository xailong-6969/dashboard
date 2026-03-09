import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { TOKEN_DECIMALS, TOKEN_SYMBOL } from "./constants";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format wallet address
export function formatAddress(address: string, chars = 4): string {
  if (!address) return "";
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

// Format large numbers with K/M/B suffixes
export function formatNumber(value: number | string, decimals = 2): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "0";
  
  if (Math.abs(num) >= 1e9) return (num / 1e9).toFixed(decimals) + "B";
  if (Math.abs(num) >= 1e6) return (num / 1e6).toFixed(decimals) + "M";
  if (Math.abs(num) >= 1e3) return (num / 1e3).toFixed(decimals) + "K";
  return num.toFixed(decimals);
}

// Format token amounts (converts from wei)
export function formatTokens(value: string | bigint, decimals = TOKEN_DECIMALS): string {
  try {
    const bigVal = typeof value === "string" ? BigInt(value) : value;
    const divisor = BigInt(10 ** decimals);
    const intPart = bigVal / divisor;
    const fracPart = bigVal % divisor;
    const fracStr = fracPart.toString().padStart(decimals, "0").slice(0, 2);
    return `${intPart.toLocaleString()}.${fracStr}`;
  } catch {
    return "0.00";
  }
}

// Format tokens with symbol
export function formatTokensWithSymbol(value: string | bigint): string {
  return `${formatTokens(value)} ${TOKEN_SYMBOL}`;
}

// Format percentage from UD60x18 price
export function formatProbability(price: string | bigint): string {
  try {
    const p = typeof price === "string" ? BigInt(price) : price;
    const percent = Number(p) / 1e16;
    return `${percent.toFixed(1)}%`;
  } catch {
    return "0%";
  }
}

// Format time ago
export function formatTimeAgo(date: Date | string): string {
  const now = new Date();
  const past = new Date(date);
  const diffMs = now.getTime() - past.getTime();
  
  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return `${seconds}s ago`;
}

// Format date
export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Parse model info from JSON
export interface ModelInfo {
  idx: number;
  familyName: string;
  modelName: string;
  commitHash?: string;
  fullName: string;
  color: string;
}

export function parseModelsJson(modelsJson: unknown): ModelInfo[] {
  const MODEL_COLORS = [
    "#3B82F6", "#F97316", "#10B981", "#8B5CF6", "#EC4899",
    "#14B8A6", "#F59E0B", "#EF4444", "#6366F1", "#84CC16",
  ];

  if (!modelsJson) return [];
  
  try {
    const models = typeof modelsJson === "string" 
      ? JSON.parse(modelsJson) 
      : modelsJson;
    
    if (!Array.isArray(models)) return [];
    
    return models.map((m: any, i: number) => ({
      idx: m.idx ?? i,
      familyName: m.familyName || m.family || "",
      modelName: m.modelName || m.name || m.model || `Model ${i}`,
      commitHash: m.commitHash || m.commit,
      fullName: m.familyName 
        ? `${m.familyName}/${m.modelName || m.name}` 
        : (m.modelName || m.name || `Model ${i}`),
      color: MODEL_COLORS[i % MODEL_COLORS.length],
    }));
  } catch {
    return [];
  }
}

// Calculate P&L for a trader's positions
export interface Position {
  marketId: string;
  modelIdx: string;
  sharesHeld: bigint;
  costBasis: bigint;
  realizedPnl: bigint;
}

export function calculatePnL(trades: Array<{
  marketId: bigint;
  modelIdx: bigint;
  isBuy: boolean;
  tokensDelta: string;
  sharesDelta: string;
}>): {
  positions: Map<string, Position>;
  totalRealizedPnl: bigint;
  totalCostBasis: bigint;
} {
  const positions = new Map<string, Position>();
  let totalRealizedPnl = 0n;
  let totalCostBasis = 0n;

  for (const trade of trades) {
    const key = `${trade.marketId}:${trade.modelIdx}`;
    let pos = positions.get(key);
    
    if (!pos) {
      pos = {
        marketId: trade.marketId.toString(),
        modelIdx: trade.modelIdx.toString(),
        sharesHeld: 0n,
        costBasis: 0n,
        realizedPnl: 0n,
      };
      positions.set(key, pos);
    }

    const tokens = BigInt(trade.tokensDelta);
    const shares = BigInt(trade.sharesDelta);
    const absTokens = tokens < 0n ? -tokens : tokens;
    const absShares = shares < 0n ? -shares : shares;

    if (trade.isBuy) {
      pos.sharesHeld += absShares;
      pos.costBasis += absTokens;
      totalCostBasis += absTokens;
    } else {
      if (pos.sharesHeld > 0n) {
        const avgCost = (pos.costBasis * BigInt(1e18)) / pos.sharesHeld;
        const costRemoved = (avgCost * absShares) / BigInt(1e18);
        const pnl = absTokens - costRemoved;
        pos.realizedPnl += pnl;
        totalRealizedPnl += pnl;
        pos.sharesHeld -= absShares;
        pos.costBasis -= costRemoved;
        if (pos.sharesHeld < 0n) pos.sharesHeld = 0n;
        if (pos.costBasis < 0n) pos.costBasis = 0n;
      } else {
        pos.realizedPnl += absTokens;
        totalRealizedPnl += absTokens;
      }
    }
  }

  return { positions, totalRealizedPnl, totalCostBasis };
}
