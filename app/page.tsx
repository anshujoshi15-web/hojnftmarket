"use client";

import { ArrowUpRight, Sparkles, TrendingUp, Users, Clock, Search, ImageIcon, Maximize2, X } from "lucide-react";
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
  const [indexWarnings, setIndexWarnings] = useState<Record<number, string>>({});
  const [recentActivity, setRecentActivity] = useState<IndexedActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [listingCount, setListingCount] = useState(0);
  const [saleCount, setSaleCount] = useState(0);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

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
        
        setFeaturedNFTs(sortedListings.slice(0, 12)); // Increased from 8 to 12 to show more NFTs
        const sales = allActivity.filter(a => (["sold","offer_accepted"].includes(a.eventType)));
        setRecentActivity(sales.slice(0, 6));
        setSaleCount(sales.length);
        setListingCount(allListings.length);
        
        // Sort collections by sales count (trending)
        setListedCollections(collections.sort((a, b) => Number(b.salesCount - a.salesCount) || Number(b.salesVolume - a.salesVolume)));
        
        if (allListings.length || collections.length) setLoading(false);
    }

    try {
      const cached = JSON.parse(window.sessionStorage.getItem("hoj-discover-listings") ?? "null") as {at:number;data:IndexerResponse[]}|null;
      if (cached && Date.now() - cached.at < 60_000 && Array.isArray(cached.data)) {
        cached.data.forEach(data => { if (liveChains.includes(data.chainId)) responses.set(`${data.chainId}:${data.legacy?"legacy":"current"}`, data); });
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
        if (!res.ok) {
          setIndexWarnings(current => ({...current, [chainId]: data.syncError ?? "Listings are temporarily unavailable."}));
          return;
        }
        setIndexWarnings(current => {
          const next={...current};
          if (data.syncError || !data.sync?.caughtUp) next[chainId]=data.syncError ?? "Older listings are still being indexed.";
          else delete next[chainId];
          return next;
        });
        responses.set(`${chainId}:current`, data);
        renderMarketplaceData();
        if(data.legacyMarketplaceAddress){
          try{
            const oldResponse=await fetch(`/api/indexer?chainId=${chainId}&legacy=1`,{cache:"no-store"});
            const old=await oldResponse.json() as IndexerResponse;
            if(oldResponse.ok){
              responses.set(`${chainId}:legacy`,{...old,legacy:true,listings:old.listings.map(item=>({...item,legacy:true}))});
              if(old.syncError||!old.sync?.caughtUp)setIndexWarnings(current=>({...current,[chainId]:`Earlier listings: ${old.syncError??"older events are still syncing."}`}));
            }
            else setIndexWarnings(current=>({...current,[chainId]:`${getMarketplaceChain(chainId).name} earlier listings: ${old.syncError??"temporarily unavailable"}`}));
          }catch{setIndexWarnings(current=>({...current,[chainId]:`${getMarketplaceChain(chainId).name} earlier listings are temporarily unavailable.`}));}
        }else responses.delete(`${chainId}:legacy`);
        renderMarketplaceData();
        try { window.sessionStorage.setItem("hoj-discover-listings", JSON.stringify({at:Date.now(),data:[...responses.values()]})); }
        catch { /* Keep the current view when storage is unavailable. */ }
        } catch { if (mounted) setIndexWarnings(current => ({...current, [chainId]: "Listings are temporarily unavailable."})); }
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
      {/* Hero Section */}
      <section className="royal-hero">
        <div className="royal-hero-content">
          <div className="royal-badge">
            <Sparkles size={16} />
            <span>House of Joshi · NFT Marketplace</span>
          </div>
          <h1>Collect what moves you.</h1>
          <p className="royal-subtitle">
            Explore real listings across supported networks. Find a work you love, inspect its details, and trade from your wallet.
          </p>
          <div className="royal-hero-actions">
            <Link href="/market" className="royal-primary-button">
              Explore NFTs
              <ArrowUpRight size={18} />
            </Link>
            <a href="https://www.nftlaunchpad.thehouseofjoshi.com/" target="_blank" rel="noopener noreferrer" className="royal-secondary-button">
              Create NFT
              <Sparkles size={18} />
            </a>
          </div>
        </div>
        <div className="royal-hero-visual">
        </div>
      </section>

      {/* Stats Bar */}
      <section className="royal-stats-bar">
        <div className="royal-stat">
          <Users size={20} />
          <div>
            <strong>{Object.keys(marketplaceChains).length}</strong>
            <span>Supported Networks</span>
          </div>
        </div>
        <div className="royal-stat">
          <TrendingUp size={20} />
          <div>
            <strong>{listingCount}</strong>
            <span>Active Listings</span>
          </div>
        </div>
        <div className="royal-stat">
          <Clock size={20} />
          <div>
            <strong>{saleCount}</strong>
            <span>Recent Sales</span>
          </div>
        </div>
      </section>

      {/* Trending Collections based on sales */}
      <section className="royal-section royal-listed-section">
        <div className="royal-section-header">
          <div>
            <span className="royal-section-label">TRENDING</span>
            <h2>Top Collections by Sales</h2>
            <p>Collections with the most sales across all networks</p>
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
            {listedCollections.length === 0 && <p className="royal-market-empty">No collections have active indexed listings yet. Check back after a seller lists an NFT.</p>}
            {listedCollections.map((collection, index) => (
              <ListedCollectionCard key={`${collection.chainId}:${collection.address}`} collection={collection} rank={index+1}/>
            ))}
          </div>
        )}
      </section>

      {/* Featured NFTs */}
      <section className="royal-section royal-section-alt royal-featured-section">
        {Object.keys(indexWarnings).length>0&&<div className="royal-index-warning" role="status">Listing data is incomplete: {Object.entries(indexWarnings).map(([id,warning])=>`${getMarketplaceChain(Number(id) as MarketplaceChainId).name}: ${warning}`).join(" ")}</div>}
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
            {featuredNFTs.length === 0 && <p className="royal-market-empty">No active NFTs are available to browse right now. Explore the market or list a work from your wallet.</p>}
            {featuredNFTs.map((nft) => {
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
            recentActivity.map((activity) => {
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
