export default function Page() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-16">
      <div className="space-y-8">
        {/* Hero Section */}
        <div className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tight text-white">
            Delphi Analytics
          </h1>
          <p className="text-lg text-neutral-400 max-w-2xl">
            Track wallet activity, analyze trading patterns, and view profit & loss for Delphi prediction markets on Gensyn Testnet.
          </p>
        </div>

        {/* Search Section */}
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-8">
          <h2 className="text-xl font-semibold text-white mb-4">
            Search Wallet Address
          </h2>
          <p className="text-sm text-neutral-400 mb-4">
            Enter any Ethereum address to view their Delphi trading activity and portfolio.
          </p>
          {/* The header already has search, but you could add another here */}
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8">
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/30 p-6">
            <div className="text-3xl mb-3">📊</div>
            <h3 className="text-lg font-semibold text-white mb-2">
              Trading Stats
            </h3>
            <p className="text-sm text-neutral-400">
              View total trades, volume, and market activity for any wallet.
            </p>
          </div>

          <div className="rounded-lg border border-neutral-800 bg-neutral-900/30 p-6">
            <div className="text-3xl mb-3">💰</div>
            <h3 className="text-lg font-semibold text-white mb-2">
              P&L Analysis
            </h3>
            <p className="text-sm text-neutral-400">
              Track realized and unrealized profit & loss with live pricing.
            </p>
          </div>

          <div className="rounded-lg border border-neutral-800 bg-neutral-900/30 p-6">
            <div className="text-3xl mb-3">📝</div>
            <h3 className="text-lg font-semibold text-white mb-2">
              Trade History
            </h3>
            <p className="text-sm text-neutral-400">
              Browse complete trading history with detailed transaction data.
            </p>
          </div>
        </div>

        {/* Footer Note */}
        <div className="pt-8 border-t border-neutral-800">
          <p className="text-xs text-neutral-500 text-center">
            Currently tracking Delphi Testnet • Contract: 0xCaC4F41DF8188034Eb459Bb4c8FaEcd6EE369fdf
          </p>
        </div>
      </div>
    </main>
  );
}
