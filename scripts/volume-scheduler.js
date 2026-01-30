const { PrismaClient } = require("@prisma/client");
const http = require("http");

const prisma = new PrismaClient();

// Update market volumes
async function updateMarketVolumes() {
    console.log("📊 Updating market volumes...");
    const markets = await prisma.market.findMany({ select: { marketId: true } });

    for (const { marketId } of markets) {
        const trades = await prisma.trade.findMany({
            where: { marketId },
            select: { tokensDelta: true }
        });

        const totalVolume = trades.reduce((acc, t) => {
            const delta = BigInt(t.tokensDelta);
            return acc + (delta < 0n ? -delta : delta);
        }, 0n);

        await prisma.market.update({
            where: { marketId },
            data: { totalVolume: totalVolume.toString(), totalTrades: trades.length }
        });

        console.log(`  Market ${marketId}: ${trades.length} trades, volume updated`);
    }
    console.log("✅ Market volumes updated");
}

// Call the cron API
async function callCronAPI() {
    const secret = process.env.CRON_SECRET || "delphi-cron-2024";
    const url = `http://localhost:3000/api/cron?secret=${secret}`;

    return new Promise((resolve) => {
        http.get(url, (res) => {
            let data = "";
            res.on("data", chunk => data += chunk);
            res.on("end", () => {
                try {
                    const json = JSON.parse(data);
                    console.log(`🔄 Cron result: indexed ${json.indexed || 0} trades`);
                } catch (e) {
                    console.log(`🔄 Cron called (status: ${res.statusCode})`);
                }
                resolve();
            });
        }).on("error", (e) => {
            console.log(`⚠️ Cron call failed: ${e.message}`);
            resolve();
        });
    });
}

// Main scheduler
async function runScheduler() {
    console.log("🚀 Volume update scheduler started");

    // Wait for Next.js server to start
    await new Promise(r => setTimeout(r, 5000));

    // Initial update
    await updateMarketVolumes();

    // Run every 60 seconds
    setInterval(async () => {
        try {
            await callCronAPI();
            await updateMarketVolumes();
        } catch (e) {
            console.error("Scheduler error:", e.message);
        }
    }, 60 * 1000);
}

// Run on module load
runScheduler().catch(console.error);
