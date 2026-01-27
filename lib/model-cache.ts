// - Called by CRON, not by page loads

import { PrismaClient } from "@prisma/client";

const DELPHI_API_BASE = "https://delphi.gensyn.ai/api";

// Cache TTL: 21 days for settled markets, 1 hour for active
const SETTLED_CACHE_TTL = 21 * 24 * 60 * 60 * 1000; // 21 days
const ACTIVE_CACHE_TTL = 1 * 60 * 60 * 1000; // 1 hour

// ============================================
// Types
// ============================================

export interface MarketModel {
  idx: number;
  name: string;
  family: string;
}

export interface CachedMarketData {
  marketId: string;
  title: string;
  status: "active" | "settled";
  models: MarketModel[];
  winningModelIdx?: number;
  winningModelName?: string;
  cachedAt: Date;
}

// ============================================
// Database Cache Operations
// ============================================

// Get cached market data from database
export async function getCachedMarkets(prisma: PrismaClient): Promise<Map<string, CachedMarketData>> {
  const markets = await prisma.market.findMany({
    select: {
      marketId: true,
      title: true,
      status: true,
      modelsJson: true,
      winningModelIdx: true,
      settledAt: true,
      createdAtTime: true,
    },
  });

  const cache = new Map<string, CachedMarketData>();

  for (const market of markets) {
    const marketId = market.marketId.toString();
    let models: MarketModel[] = [];

    // Parse models from JSON
    if (market.modelsJson) {
      try {
        const parsed = typeof market.modelsJson === 'string' 
          ? JSON.parse(market.modelsJson) 
          : market.modelsJson;
        if (Array.isArray(parsed)) {
          models = parsed.map((m: any) => ({
            idx: m.idx ?? m.modelIdx ?? 0,
            name: m.name || m.modelName || `Model ${m.idx}`,
            family: m.family || m.familyName || "",
          }));
        }
      } catch (e) {
        // Invalid JSON, need to discover
      }
    }

    // Use settledAt or createdAtTime as cache timestamp
    const cacheTimestamp = market.settledAt || market.createdAtTime || new Date(0);

    cache.set(marketId, {
      marketId,
      title: market.title || `Market #${marketId}`,
      status: market.status === 2 ? "settled" : "active",
      models,
      winningModelIdx: market.winningModelIdx !== null ? Number(market.winningModelIdx) : undefined,
      winningModelName: market.winningModelIdx !== null && models.length > 0
        ? models.find(m => m.idx === Number(market.winningModelIdx))?.name
        : undefined,
      cachedAt: cacheTimestamp,
    });
  }

  return cache;
}

// Check if cache needs refresh
export function needsRefresh(cached: CachedMarketData | undefined): boolean {
  if (!cached) return true;
  if (cached.models.length === 0) return true;

  // For settled markets with models, don't refresh
  if (cached.status === "settled" && cached.models.length >= 5) {
    return false;
  }

  // For active markets, check TTL
  const age = Date.now() - cached.cachedAt.getTime();
  const ttl = cached.status === "settled" ? SETTLED_CACHE_TTL : ACTIVE_CACHE_TTL;

  return age > ttl;
}

// ============================================
// Delphi API Functions
// ============================================

async function fetchClosedMarketsWithWinners(address: string): Promise<Array<{
  marketId: string;
  marketName: string;
  winningModelIdx: number;
  winningModelName: string;
}>> {
  try {
    const url = `${DELPHI_API_BASE}/user/${address}/closedMarketsWithWinners`;
    const res = await fetch(url, {
      cache: 'no-store',
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) return [];

    const json = await res.json();
    const data = json.data || json || [];

    if (!Array.isArray(data)) return [];

    return data.map((m: any) => ({
      marketId: m.marketId?.toString() || "",
      marketName: m.marketName || "",
      winningModelIdx: parseInt(m.winningModelIdx?.toString() || "0"),
      winningModelName: m.winningModelName || "",
    }));
  } catch (e) {
    return [];
  }
}

async function fetchUserActivity(address: string, marketId: string): Promise<any[]> {
  try {
    const url = `${DELPHI_API_BASE}/user/${address}/activity?marketId=${marketId}&limit=500`;
    const res = await fetch(url, {
      cache: 'no-store',
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) return [];
    const data = await res.json();
    return data.items || [];
  } catch (e) {
    return [];
  }
}

// ============================================
// Model Discovery (called by CRON only)
// ============================================

export async function discoverAndCacheModels(
  prisma: PrismaClient,
  options: {
    forceRefresh?: boolean;
    onProgress?: (msg: string) => void;
  } = {}
): Promise<{
  discovered: number;
  cached: number;
  errors: string[];
}> {
  const log = options.onProgress || console.log;
  const errors: string[] = [];
  let discovered = 0;
  let cached = 0;

  try {
    // Get existing cache
    const existingCache = await getCachedMarkets(prisma);
    log(`📦 Found ${existingCache.size} markets in cache`);

    // Get top traders for API calls
    const topTraders = await prisma.traderStats.findMany({
      orderBy: { totalTrades: 'desc' },
      select: { address: true },
      take: 20,
    });

    let traderAddresses = topTraders.map(t => t.address);

    if (traderAddresses.length === 0) {
      const fallback = await prisma.trade.groupBy({
        by: ['trader'],
        _count: { trader: true },
        orderBy: { _count: { trader: 'desc' } },
        take: 20,
      });
      traderAddresses = fallback.map(t => t.trader);
    }

    if (traderAddresses.length === 0) {
      log("⚠️ No traders found, skipping model discovery");
      return { discovered: 0, cached: existingCache.size, errors: ["No traders found"] };
    }

    log(`👥 Using ${traderAddresses.length} traders for discovery`);

    // Step 1: Discover settled markets with winners
    log("🏆 Fetching settled markets...");
    const settledMarkets = new Map<string, { name: string; winnerIdx: number; winnerName: string }>();

    for (let i = 0; i < Math.min(3, traderAddresses.length); i++) {
      const closed = await fetchClosedMarketsWithWinners(traderAddresses[i]);
      for (const m of closed) {
        if (!settledMarkets.has(m.marketId)) {
          settledMarkets.set(m.marketId, {
            name: m.marketName,
            winnerIdx: m.winningModelIdx,
            winnerName: m.winningModelName,
          });
          log(`  ✓ Market #${m.marketId}: Winner = ${m.winningModelName} (idx ${m.winningModelIdx})`);
        }
      }
      if (settledMarkets.size > 0) break;
    }

    // Step 2: Get all market IDs to process
    const allMarketIds = await prisma.market.findMany({
      select: { marketId: true, status: true },
    });

    // Add known market IDs
    const marketIdsToProcess = new Set<string>();
    for (const m of allMarketIds) {
      marketIdsToProcess.add(m.marketId.toString());
    }
    for (const id of settledMarkets.keys()) {
      marketIdsToProcess.add(id);
    }
    // Known active markets
    marketIdsToProcess.add("3");

    log(`📊 Processing ${marketIdsToProcess.size} markets`);

    // Step 3: Discover models for markets that need refresh
    for (const marketId of marketIdsToProcess) {
      const cachedData = existingCache.get(marketId);
      const settled = settledMarkets.get(marketId);

      // Check if we need to refresh
      if (!options.forceRefresh && cachedData && !needsRefresh(cachedData)) {
        log(`  📦 Market #${marketId}: Using cache (${cachedData.models.length} models)`);
        cached++;
        continue;
      }

      // Need to discover models
      log(`  🔍 Market #${marketId}: Discovering models...`);

      const foundModels = new Map<number, { name: string; family: string }>();
      let marketStatus: "active" | "settled" = settled ? "settled" : "active";

      // Query multiple traders until we find 5 models
      for (const address of traderAddresses) {
        if (foundModels.size >= 5) break;

        const activity = await fetchUserActivity(address, marketId);
        if (activity.length === 0) continue;

        // Get status from activity
        if (activity[0]?.is_market_closed) {
          marketStatus = "settled";
        }

        for (const item of activity) {
          const idx = parseInt(item.allowed_model_idx?.toString() || "-1");
          if (idx < 0 || foundModels.has(idx)) continue;

          const modelName = item.model_name || "";
          if (!modelName) continue;

          foundModels.set(idx, {
            name: modelName.toUpperCase(),
            family: (item.model_family_name || "").toUpperCase(),
          });
        }

        // Small delay between API calls
        await new Promise(r => setTimeout(r, 100));
      }

      if (foundModels.size === 0) {
        log(`    ⚠️ No models found for Market #${marketId}`);
        errors.push(`No models found for Market #${marketId}`);
        continue;
      }

      log(`    ✅ Found ${foundModels.size} models`);
      discovered++;

      // Build models array
      const models: MarketModel[] = Array.from(foundModels.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([idx, data]) => ({
          idx,
          name: data.name,
          family: data.family,
        }));

      // Get market title
      let title = cachedData?.title || `Market #${marketId}`;
      if (settled?.name) {
        title = settled.name;
      }

      // Update database
      const winnerIdx = settled?.winnerIdx ?? cachedData?.winningModelIdx ?? null;

      await prisma.market.upsert({
        where: { marketId: BigInt(marketId) },
        update: {
          title,
          status: marketStatus === "settled" ? 2 : 0,
          modelsJson: JSON.stringify(models),
          winningModelIdx: winnerIdx !== null ? BigInt(winnerIdx) : null,
        },
        create: {
          marketId: BigInt(marketId),
          title,
          status: marketStatus === "settled" ? 2 : 0,
          modelsJson: JSON.stringify(models),
          winningModelIdx: winnerIdx !== null ? BigInt(winnerIdx) : null,
        },
      });

      log(`    💾 Saved to database`);
    }

    return { discovered, cached, errors };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    errors.push(msg);
    log(`❌ Error: ${msg}`);
    return { discovered, cached, errors };
  }
}

// ============================================
// Helper for pages (reads from DB only, no API calls)
// ============================================

export async function getMarketsFromCache(prisma: PrismaClient): Promise<{
  active: CachedMarketData[];
  settled: CachedMarketData[];
}> {
  const cache = await getCachedMarkets(prisma);

  const active: CachedMarketData[] = [];
  const settled: CachedMarketData[] = [];

  for (const market of cache.values()) {
    // Find winner name if not set
    if (market.winningModelIdx !== undefined && !market.winningModelName) {
      const winner = market.models.find(m => m.idx === market.winningModelIdx);
      if (winner) {
        market.winningModelName = winner.name;
      }
    }

    if (market.status === "settled") {
      settled.push(market);
    } else {
      active.push(market);
    }
  }

  // Sort by marketId desc
  active.sort((a, b) => parseInt(b.marketId) - parseInt(a.marketId));
  settled.sort((a, b) => parseInt(b.marketId) - parseInt(a.marketId));

  return { active, settled };
}
