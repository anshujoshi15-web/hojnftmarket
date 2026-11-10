"use client";

import { useEffect, useState } from "react";
import type { ComponentProps } from "react";
import { getMarketplaceChain, isMarketplaceChainId, marketplaceChains, type MarketplaceChainId } from "@/lib/marketplace-chains";
import { MARKETPLACE_REFRESH_INTERVAL, onMarketplaceUpdate } from "@/lib/marketplace-refresh";
import { MarketView } from "../portal";

type MarketData = ComponentProps<typeof MarketView>["data"];
type Feed = { chainId: MarketplaceChainId; legacy: boolean };
const liveNetworks = Object.values(marketplaceChains).filter(network => network.marketplaceStatus === "live");
const feeds: Feed[] = liveNetworks.flatMap(network => [
  { chainId: network.id, legacy: false },
  { chainId: network.id, legacy: true },
]);

function ignoreTrade() {}

export function CombinedMarket({ initialChain }: { initialChain?: number }) {
  const [network, setNetwork] = useState<MarketplaceChainId | "all">(
    initialChain !== undefined && isMarketplaceChainId(initialChain) ? initialChain : "all",
  );
  const [results, setResults] = useState<Record<string, MarketData>>({});
  const [pending, setPending] = useState(true);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let refreshing = false;
    async function refresh() {
      if (refreshing) return;
      refreshing = true;
      await Promise.allSettled(feeds.map(async ({ chainId, legacy }) => {
        const key = `${chainId}:${legacy}`;
        let result: MarketData;
        const chain = getMarketplaceChain(chainId);
        const empty = { chainId, chain: chain.name, currency: chain.currency, explorerUrl: chain.explorerUrl, configured: true, listings: [], activity: [] };
        try {
          const response = await fetch(`/api/indexer?chainId=${chainId}&view=discover${legacy ? "&legacy=1" : ""}`, { signal: controller.signal, cache: "no-store" });
          const body = await response.json() as MarketData;
          result = !response.ok || body.stale
            ? { ...empty, syncError: legacy && response.status === 404 ? null : body.syncError ?? "Listings are temporarily unavailable." }
            : { ...body, ...empty, configured: body.configured, listings: (body.listings ?? []).map(item => ({ ...item, legacy })).sort((a, b) => b.updatedBlock - a.updatedBlock) };
        } catch {
          result = { ...empty, syncError: "Listings are temporarily unavailable." };
        }
        if (!controller.signal.aborted) setResults(previous => ({ ...previous, [key]: result }));
      }));
      if (!controller.signal.aborted) setPending(false);
      refreshing = false;
    }
    void refresh();
    const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, MARKETPLACE_REFRESH_INTERVAL);
    const unsubscribe = onMarketplaceUpdate(() => { void refresh(); });
    return () => {
      controller.abort();
      window.clearInterval(timer);
      unsubscribe();
    };
  }, [revision]);

  const selected = Object.values(results).filter(result => network === "all" || result.chainId === network);
  const chain = getMarketplaceChain(network === "all" ? 137 : network);
  const byNetwork = new Map<MarketplaceChainId, MarketData["listings"]>();
  for (const result of selected) {
    const items = byNetwork.get(result.chainId) ?? [];
    byNetwork.set(result.chainId, items.concat(result.listings));
  }
  const rankedListings = [...byNetwork.entries()].flatMap(([chainId, items]) =>
    items.sort((a, b) => b.updatedBlock - a.updatedBlock).map((item, rank) => ({ item, rank, chainId })),
  );
  rankedListings.sort((a, b) => a.rank - b.rank || a.chainId - b.chainId);
  const listings = rankedListings.map(({ item }) => item);
  const failedNetworks = [...new Set(selected.filter(result => result.syncError).map(result => result.chain))];
  const data: MarketData = {
    chainId: chain.id,
    chain: network === "all" ? "All networks" : chain.name,
    currency: chain.currency,
    explorerUrl: chain.explorerUrl,
    configured: network === "all" || chain.marketplaceStatus === "live",
    listings,
    activity: [],
    syncError: selected.find(result => result.syncError)?.syncError,
  };

  return <main className="royal-portal-page royal-portal-market">
    <div className="royal-portal-content">
      <MarketView key={network} data={data} loading={pending} combined legacy={false}
        advancedMarketplace={false} onNetworkChange={setNetwork} onBuy={ignoreTrade}
        onBatchBuy={ignoreTrade} onOffer={ignoreTrade} onCancel={ignoreTrade}
        onRetry={()=>{setPending(true);setRevision(value=>value+1);}}/>
      {!pending&&listings.length>0&&failedNetworks.length>0&&
        <p className="royal-index-warning" role="status">Some listings may be missing on {failedNetworks.join(", ")}.</p>}
    </div>
  </main>;
}
