import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatAddress(address: string, chars = 4): string {
  if (!address) return "";
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

export function formatNumber(value: number | string, decimals = 2): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "0";
  
  if (Math.abs(num) >= 1e9) return (num / 1e9).toFixed(decimals) + "B";
  if (Math.abs(num) >= 1e6) return (num / 1e6).toFixed(decimals) + "M";
  if (Math.abs(num) >= 1e3) return (num / 1e3).toFixed(decimals) + "K";
  return num.toFixed(decimals);
}

export function formatTokens(value: string | bigint, decimals = 18): string {
  const bigVal = typeof value === "string" ? BigInt(value) : value;
  const divisor = BigInt(10 ** decimals);
  const intPart = bigVal / divisor;
  const fracPart = bigVal % divisor;
  const fracStr = fracPart.toString().padStart(decimals, "0").slice(0, 4);
  return `${intPart.toLocaleString()}.${fracStr}`;
}

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

export const TIMEFRAMES = [
  { label: "1H", value: "1h", hours: 1 },
  { label: "4H", value: "4h", hours: 4 },
  { label: "1D", value: "1d", hours: 24 },
  { label: "1W", value: "1w", hours: 168 },
  { label: "1M", value: "1m", hours: 720 },
] as const;

export type TimeframeValue = typeof TIMEFRAMES[number]["value"];
