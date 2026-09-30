"use client";

import { ArrowUpRight, Sparkles, TrendingUp, Clock, Search, ImageIcon, Maximize2, X } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { formatEther } from "viem";
import { getMarketplaceChain, marketplaceChains, type MarketplaceChainId } from "@/lib/marketplace-chains";
import { MARKETPLACE_REFRESH_INTERVAL, onMarketplaceUpdate } from "@/lib/marketplace-refresh";

type IndexedListing = {
  id: string;
  chainId: MarketplaceChainId;
  nftAddress: `0x${string}`;
  tokenId: string;
  seller: `0x${string}`;
  price: string;
  transactionHash: `0x${string}`;
  createdBlock: number;
  updatedBlock: number;
  legacy?:boolean;
};

type IndexedActivity = {
  id: string;
  chainId: MarketplaceChainId;
  eventType: "listed" | "sold" | "canceled" | "withdrawn";
  nftAddress: `0x${string}` | null;
  tokenId: string | null;
  seller: `0x${string}` | null;
  buyer: `0x${string}` | null;
  price: string | null;
  transactionHash: `0x${string}`;
  blockNumber: number;
  logIndex: number;
  timestamp?: number;
};

type IndexerResponse = {
  chainId: MarketplaceChainId;
  chain: string;
  currency: string;
  configured: boolean;
  marketplaceAddress?: `0x${string}`;
  legacyMarketplaceAddress?:`0x${string}`|null;
  legacy?:boolean;
  listings: IndexedListing[];
  activity: IndexedActivity[];
  collections?: Array<{ nftAddress: `0x${string}`; floorPrice: string; listingCount: number; latestBlock: number; sampleTokenId: string }>;
  sync: { caughtUp: boolean; syncedThrough: number; safeLatest: number } | null;
  syncError?: string | null;
};

type ListedCollection = {
  sampleTokenId: string;
  address: `0x${string}`;
  floorPrice: string;
  listingCount: number;
  complete: boolean;
  chainId: MarketplaceChainId;
  salesVolume: bigint;
  salesCount: number;
};

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function ListedCollectionCard({collection,rank}:{collection:ListedCollection;rank:number}) {
  const [metadata,setMetadata]=useState<{collection?:string}|null>(null);
  const [failed,setFailed]=useState(false);
  const chain = getMarketplaceChain(collection.chainId);
  const artworkUrl = `/api/nft-image?chainId=${collection.chainId}&contract=${collection.address}&tokenId=${collection.sampleTokenId}`;
  useEffect(()=>{
    const controller=new AbortController();
    void fetch(`/api/nft?chainId=${collection.chainId}&contract=${collection.address}&tokenId=${collection.sampleTokenId}`,{signal:controller.signal})
      .then(response=>response.ok?response.json() as Promise<{collection?:string}>:null).then(data=>setMetadata(data)).catch(()=>{});
    return()=>controller.abort();
  },[collection.chainId,collection.address,collection.sampleTokenId]);
  return <Link href={`/collection/${collection.chainId}/${collection.address}`} className="hoj-listed-collection">
    <div className="hoj-listed-art">{!failed?<Image src={artworkUrl} alt={metadata?.collection??"Collection artwork"} width={112} height={112} unoptimized onError={()=>setFailed(true)}/>:<ImageIcon size={30} aria-label="Artwork unavailable"/>}</div>
    <div className="hoj-listed-content">
      <div className="hoj-listed-heading"><span className="hoj-trending-badge"><TrendingUp size={14}/> #{String(rank).padStart(2,"0")}</span><span>{chain.name}</span><ArrowUpRight size={17} aria-hidden="true"/></div>
      <h3>{metadata?.collection??shortAddress(collection.address)}</h3>
      <div className="hoj-listed-metrics">
        <div><small>LISTED</small><strong>{collection.listingCount}</strong></div>
        <div><small>SALES</small><strong>{collection.salesCount}</strong></div>
        <div><small>VOLUME</small><strong>{collection.salesVolume > 0n ? formatEther(collection.salesVolume) : "—"} {chain.currency}</strong></div>
        <div><small>{collection.complete?"FLOOR":"LOW"}</small><strong>{formatEther(BigInt(collection.floorPrice))} {chain.currency}</strong></div>
      </div>
    </div>
  </Link>;
}

function DiscoverShowcaseCard({collection,rank}:{collection:ListedCollection;rank:number}) {
  const [name,setName]=useState<string|null>(null);
  const [failed,setFailed]=useState(false);
  const chain=getMarketplaceChain(collection.chainId);
  const artworkUrl=`/api/nft-image?chainId=${collection.chainId}&contract=${collection.address}&tokenId=${collection.sampleTokenId}`;
  useEffect(()=>{
    const controller=new AbortController();
    void fetch(`/api/nft?chainId=${collection.chainId}&contract=${collection.address}&tokenId=${collection.sampleTokenId}`,{signal:controller.signal})
      .then(response=>response.ok?response.json() as Promise<{collection?:string|null}>:null)
      .then(data=>setName(data?.collection??null)).catch(()=>{});
    return()=>controller.abort();
  },[collection.chainId,collection.address,collection.sampleTokenId]);
  return <Link className="discover-showcase-card" href={`/collection/${collection.chainId}/${collection.address}`}>
    {!failed?<Image src={artworkUrl} alt={name??`${chain.name} collection artwork`} fill unoptimized sizes="(max-width: 700px) 85vw, 34vw" onError={()=>setFailed(true)}/>:<div className="discover-showcase-fallback"><ImageIcon size={42}/></div>}
    <span className="discover-showcase-shade"/>
    <div className="discover-showcase-top"><span>FEATURED #{rank}</span><span>{chain.name}</span></div>
    <div className="discover-showcase-copy"><h2>{name??shortAddress(collection.address)}</h2><div><span><small>LISTED</small><strong>{collection.listingCount}</strong></span><span><small>FLOOR</small><strong>{formatEther(BigInt(collection.floorPrice))} {chain.currency}</strong></span><span><small>SALES</small><strong>{collection.salesCount}</strong></span></div></div>
  </Link>;
}

function FeaturedArtwork({ listing, onExpand }: { listing: IndexedListing; onExpand: (url: string) => void }) {
  const [failed, setFailed] = useState(false);
  const imageUrl = `/api/nft-image?chainId=${listing.chainId}&contract=${listing.nftAddress}&tokenId=${listing.tokenId}`;
  return !failed
    ? (
      <>
        <img 
          src={imageUrl} 
          alt={`NFT #${listing.tokenId}`} 
          loading="lazy" 
          onError={() => setFailed(true)} 
          className="royal-featured-artwork"
          onClick={(e) => {
            e.preventDefault();
            onExpand(imageUrl);
          }}
          style={{ cursor: 'pointer' }}
        />
        <button 
          className="royal-expand-button"
          onClick={(e) => {
            e.preventDefault();
            onExpand(imageUrl);
          }}
          aria-label="Expand image"
        >
          <Maximize2 size={20} />
        </button>
      </>
    )
    : <div className="royal-nft-placeholder"><ImageIcon size={36} aria-label="Artwork unavailable" /></div>;
}

export default function Home() {
  const [listedCollections, setListedCollections] = useState<ListedCollection[]>([]);
  const [featuredNFTs, setFeaturedNFTs] = useState<IndexedListing[]>([]);
  const [recentActivity, setRecentActivity] = useState<IndexedActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [activeChain,setActiveChain]=useState<MarketplaceChainId|"all">("all");
  const visibleCollections=listedCollections.filter(collection=>activeChain==="all"||collection.chainId===activeChain);
  const visibleNFTs=featuredNFTs.filter(item=>activeChain==="all"||item.chainId===activeChain).slice(0,12);
  const visibleActivity=recentActivity.filter(item=>activeChain==="all"||item.chainId===activeChain).slice(0,6);

  useEffect(() => {
    let mounted = true;
    let refreshing = false;
    let refreshAgain = false;
    const responses = new Map<string, IndexerResponse>();
    const liveChains = (Object.keys(marketplaceChains).map(Number) as MarketplaceChainId[])
      .filter(chainId => marketplaceChains[chainId].marketplaceStatus === "live");

    function renderMarketplaceData() {
        if (!mounted) return;
        const allListings: IndexedListing[] = [];
        const allActivity: IndexedActivity[] = [];

        const collections: ListedCollection[] = [];
        responses.forEach((data) => {
            if (!data.configured) return;
            allListings.push(...data.listings);
            allActivity.push(...data.activity);
            for (const collection of data.legacy?[]:data.collections ?? []) {
              collections.push({
                address: collection.nftAddress,
                sampleTokenId: collection.sampleTokenId,
                chainId: data.chainId,
                floorPrice: collection.floorPrice,
                listingCount: collection.listingCount,
                complete: Boolean(data.sync?.caughtUp && !data.syncError),
                salesVolume: 0n,
                salesCount: 0,
              });
            }
        });
        
        // Calculate sales volume and count for each collection
        const collectionSales = new Map<string, { volume: bigint; count: number }>();
        allActivity.forEach(activity => {
          if (activity.nftAddress && ["sold", "offer_accepted"].includes(activity.eventType) && activity.price) {
            const key = `${activity.chainId}:${activity.nftAddress.toLowerCase()}`;
            const current = collectionSales.get(key) || { volume: 0n, count: 0 };
            collectionSales.set(key, {
              volume: current.volume + BigInt(activity.price),
              count: current.count + 1
            });
          }
        });
        
        // Update collections with sales data
        collections.forEach(collection => {
          const key = `${collection.chainId}:${collection.address.toLowerCase()}`;
          const salesData = collectionSales.get(key);
          if (salesData) {
            collection.salesVolume = salesData.volume;
            collection.salesCount = salesData.count;
          }
        });
        
        const activityTimes = new Map(allActivity.map(event => [`${event.chainId}:${event.transactionHash.toLowerCase()}`, event.timestamp ?? 0]));
        
        const sortedListings = allListings.sort((a,b) => {
          const aTime = activityTimes.get(`${a.chainId}:${a.transactionHash.toLowerCase()}`) ?? 0;
          const bTime = activityTimes.get(`${b.chainId}:${b.transactionHash.toLowerCase()}`) ?? 0;
          return bTime-aTime || (a.chainId===b.chainId ? b.updatedBlock-a.updatedBlock : 0);
        });
        
        setFeaturedNFTs(sortedListings);
        const sales = allActivity.filter(a => (["sold","offer_accepted"].includes(a.eventType)))
          .sort((a,b)=>(b.timestamp??0)-(a.timestamp??0)||b.blockNumber-a.blockNumber||b.logIndex-a.logIndex);
        setRecentActivity(sales);
        
        // Sort collections by sales count (trending)
        setListedCollections(collections.sort((a, b) => b.salesCount-a.salesCount || b.listingCount-a.listingCount));
        
        if (allListings.length || collections.length) setLoading(false);
    }

    try {
      const cached = JSON.parse(window.sessionStorage.getItem("hoj-discover-listings") ?? "null") as {at:number;data:IndexerResponse[]}|null;
      if (cached && Date.now() - cached.at < 60_000 && Array.isArray(cached.data)) {
        cached.data.forEach(data => { if (liveChains.includes(data.chainId)&&!data.legacy) responses.set(`${data.chainId}:current`, data); });
        if (responses.size) renderMarketplaceData();
      }
    } catch { /* A fresh network read will replace an unavailable snapshot. */ }

    async function loadMarketplaceData(onlyChainId?: number) {
      if (refreshing) { if (onlyChainId !== undefined) refreshAgain = true; return; }
      refreshing = true;
      try {
      await Promise.allSettled(liveChains.filter(chainId => onlyChainId === undefined || chainId === onlyChainId).map(async chainId => {
        try {
        const res = await fetch(`/api/indexer?chainId=${chainId}`, { cache: "no-store" });
        const data = await res.json() as IndexerResponse;
        if (!mounted) return;
        if (!res.ok) return;
        responses.set(`${chainId}:current`, data);
        renderMarketplaceData();
        responses.delete(`${chainId}:legacy`);
        renderMarketplaceData();
        try { window.sessionStorage.setItem("hoj-discover-listings", JSON.stringify({at:Date.now(),data:[...responses.values()]})); }
        catch { /* Keep the current view when storage is unavailable. */ }
        } catch { /* Keep available listings from other networks visible. */ }
      }));
      if (mounted) setLoading(false);
      } finally { refreshing = false; if (refreshAgain && mounted) { refreshAgain = false; void loadMarketplaceData(); } }
    }

    void loadMarketplaceData();
    const timer = window.setInterval(() => { if (!document.hidden) void loadMarketplaceData(); }, MARKETPLACE_REFRESH_INTERVAL);
    const onFocus = () => { if (!document.hidden) void loadMarketplaceData(); };
    window.addEventListener("focus", onFocus);
    const unsubscribe = onMarketplaceUpdate(chainId => { void loadMarketplaceData(chainId); });
    return () => { mounted = false; window.clearInterval(timer); window.removeEventListener("focus", onFocus); unsubscribe(); };
  }, []);

  return (
    <main className="royal-homepage">
      <section className="discover-intro">
        <div className="discover-intro-head">
          <div><span className="royal-section-label">HOUSE OF JOSHI · NFT MARKETPLACE</span><h1>Discover</h1><p>Find work across live networks. Explore collections and listings, then trade from your wallet.</p></div>
        </div>
        <div className="discover-chain-pills" aria-label="Filter by network">
          <button type="button" aria-pressed={activeChain==="all"} onClick={()=>setActiveChain("all")}>All networks</button>
          {(Object.keys(marketplaceChains).map(Number) as MarketplaceChainId[]).filter(id=>marketplaceChains[id].marketplaceStatus==="live").map(id=><button key={id} type="button" aria-pressed={activeChain===id} onClick={()=>setActiveChain(id)}>{marketplaceChains[id].name}</button>)}
        </div>
      </section>
      <section className="discover-showcase" aria-label="Featured collections">
        {loading?<div className="discover-showcase-loading">Loading collections…</div>:visibleCollections.length===0?<div className="discover-showcase-loading">No active collections on this network yet.</div>:visibleCollections.slice(0,5).map((collection,index)=><DiscoverShowcaseCard key={`${collection.chainId}:${collection.address}`} collection={collection} rank={index+1}/>)}
      </section>

      {/* Trending Collections based on sales */}
      <section className="royal-section royal-listed-section">
        <div className="royal-section-header">
          <div>
            <span className="royal-section-label">TRENDING</span>
            <h2>Top Collections</h2>
          </div>
          <Link href="/collections" className="royal-view-all">
            View All
            <ArrowUpRight size={16} />
          </Link>
        </div>
        {loading ? (
          <div className="royal-loading-grid">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="royal-skeleton-card" />
            ))}
          </div>
        ) : (
          <div className="royal-collections-grid">
            {visibleCollections.length === 0 && <p className="royal-market-empty">No collections have active indexed listings on this network yet.</p>}
            {visibleCollections.map((collection, index) => (
              <ListedCollectionCard key={`${collection.chainId}:${collection.address}`} collection={collection} rank={index+1}/>
            ))}
          </div>
        )}
      </section>

      {/* Featured NFTs */}
      <section className="royal-section royal-section-alt royal-featured-section">
        <div className="royal-section-header">
          <div>
            <span className="royal-section-label">EXPLORE</span>
            <h2>Explore listed NFTs</h2>
          </div>
          <Link href="/market" className="royal-view-all">
            View All
            <ArrowUpRight size={16} />
          </Link>
        </div>
        {loading ? (
          <div className="royal-loading-grid">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="royal-skeleton-card" />
            ))}
          </div>
        ) : (
          <div className="royal-nfts-grid">
            {visibleNFTs.length === 0 && <p className="royal-market-empty">No active NFTs are available on this network right now.</p>}
            {visibleNFTs.map((nft) => {
              const chain = getMarketplaceChain(nft.chainId);
              return (
                <div className="nft-card-with-action" key={`${nft.id}:${nft.legacy?"legacy":"current"}`}>
                <Link 
                  href={`/nft/${nft.chainId}/${nft.nftAddress}/${nft.tokenId}${nft.legacy?"?legacy=1":""}`}
                  className="royal-nft-card"
                >
                  <div className="royal-nft-image">
                    <FeaturedArtwork listing={nft} onExpand={setLightboxImage} />
                    <div className="royal-nft-overlay">
                      <span className="royal-quick-view" aria-hidden="true">
                        <Search size={20} />
                      </span>
                    </div>
                  </div>
                  <div className="royal-nft-info">
                    <div className="royal-nft-collection">
                      <span>{chain.name}</span>
                      <strong>{shortAddress(nft.nftAddress)}</strong>
                    </div>
                    <h3>Token #{nft.tokenId}</h3>
                    <div className="royal-nft-price">
                      <span>Current Price</span>
                      <strong>{formatEther(BigInt(nft.price))} {chain.currency}</strong>
                    </div>
                  </div>
                </Link>
                {BigInt(nft.price)>0n&&<Link className="nft-card-buy-now" href={`/nft/${nft.chainId}/${nft.nftAddress}/${nft.tokenId}${nft.legacy?"?legacy=1":""}`}>Buy now <ArrowUpRight size={15}/></Link>}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Recent Activity */}
      <section className="royal-section royal-section-alt">
        <div className="royal-section-header">
          <div>
            <span className="royal-section-label">ACTIVITY</span>
            <h2>Recent Activity</h2>
          </div>
          <Link href="/activity" className="royal-view-all">
            View All
            <ArrowUpRight size={16} />
          </Link>
        </div>
        <div className="royal-activity-list">
          {loading ? (
            <div className="royal-loading-activity">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="royal-activity-skeleton" />
              ))}
            </div>
          ) : (
            visibleActivity.length===0?<p className="royal-market-empty">No recorded sales on this network yet.</p>:visibleActivity.map((activity) => {
              const chain = getMarketplaceChain(activity.chainId);
              return (
                <div key={activity.id} className="royal-activity-item">
                  <div className="royal-activity-type">
                    <Clock size={16} />
                    <span>Sold</span>
                  </div>
                  <div className="royal-activity-details">
                    <strong>Token #{activity.tokenId}</strong>
                    <span>{shortAddress(activity.nftAddress || "")}</span>
                  </div>
                  <div className="royal-activity-price">
                    <strong>{activity.price ? formatEther(BigInt(activity.price)) : "0"} {chain.currency}</strong>
                  </div>
                  <div className="royal-activity-chain">
                    <span>{chain.name}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Royal Vault CTA */}
      <section className="royal-vault-cta">
        <div className="royal-vault-content">
          <h2>Explore collections</h2>
          <p>
            Browse collections with marketplace activity, then open an NFT to see its verified metadata and listing details.
          </p>
          <Link href="/collections" className="royal-vault-button">
            Browse collections
            <Sparkles size={20} />
          </Link>
        </div>
      </section>

      {/* How It Works */}
      <section className="royal-section">
        <div className="royal-section-header centered">
          <span className="royal-section-label">GUIDE</span>
          <h2>How It Works</h2>
        </div>
        <div className="royal-steps-grid">
          <div className="royal-step-card">
            <div className="royal-step-number">1</div>
            <h3>Connect Your Wallet</h3>
            <p>Connect your wallet and choose the live network where you want to trade.</p>
          </div>
          <div className="royal-step-card">
            <div className="royal-step-number">2</div>
            <h3>Explore Collections</h3>
            <p>Check each NFT’s network, collection contract, token ID, price, and listing status.</p>
          </div>
          <div className="royal-step-card">
            <div className="royal-step-number">3</div>
            <h3>Make Your Move</h3>
            <p>Confirm purchases in your wallet. To sell, approve the collection if needed, then list one NFT or a V8 batch.</p>
          </div>
        </div>
      </section>
      
      {/* Lightbox for full image view */}
      {lightboxImage && (
        <div 
          className="royal-lightbox"
          onClick={() => setLightboxImage(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Image lightbox"
        >
          <button 
            className="royal-lightbox-close"
            onClick={() => setLightboxImage(null)}
            aria-label="Close lightbox"
          >
            <X size={24} />
          </button>
          <div className="royal-lightbox-content" onClick={(e) => e.stopPropagation()}>
            <img 
              src={lightboxImage} 
              alt="Full size NFT image" 
              onClick={() => setLightboxImage(null)}
            />
          </div>
        </div>
      )}
    </main>
  );
}
