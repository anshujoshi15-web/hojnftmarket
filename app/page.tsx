"use client";

import { ArrowUpRight, Sparkles, TrendingUp, Clock, Search, ImageIcon, Maximize2, X } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatEther } from "viem";
import { getMarketplaceChain, isMarketplaceChainId, marketplaceChains, type MarketplaceChainId } from "@/lib/marketplace-chains";
import { MARKETPLACE_REFRESH_INTERVAL, onMarketplaceUpdate } from "@/lib/marketplace-refresh";
import { UsdEstimate } from "./components/usd-estimate";

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
  const [metadata,setMetadata]=useState<{collection?:string;imageUrl?:string|null;videoUrl?:string|null}|null>(null);
  const [failed,setFailed]=useState(false);
  const [videoFailed,setVideoFailed]=useState(false);
  const chain = getMarketplaceChain(collection.chainId);
  const artworkUrl = `/api/nft-image?chainId=${collection.chainId}&contract=${collection.address}&tokenId=${collection.sampleTokenId}`;
  useEffect(()=>{
    const controller=new AbortController();
    void fetch(`/api/nft?chainId=${collection.chainId}&contract=${collection.address}&tokenId=${collection.sampleTokenId}`,{signal:controller.signal})
      .then(response=>response.ok?response.json() as Promise<{collection?:string;imageUrl?:string|null;videoUrl?:string|null}>:null).then(data=>setMetadata(data)).catch(()=>{});
    return()=>controller.abort();
  },[collection.chainId,collection.address,collection.sampleTokenId]);
  return <Link href={`/collection/${collection.chainId}/${collection.address}`} className="hoj-listed-collection">
    <div className="hoj-listed-art">{metadata?.videoUrl&&!videoFailed?<video src={metadata.videoUrl} poster={metadata.imageUrl??undefined} muted playsInline preload="metadata" aria-label={metadata.collection??"Collection artwork"} onError={()=>setVideoFailed(true)}/>:!failed?<Image src={metadata?.imageUrl??artworkUrl} alt={metadata?.collection??"Collection artwork"} width={112} height={112} unoptimized onError={()=>setFailed(true)}/>:<ImageIcon size={30} aria-label="Artwork unavailable"/>}</div>
    <div className="hoj-listed-content">
      <div className="hoj-listed-heading"><span className="hoj-trending-badge"><TrendingUp size={14}/> #{String(rank).padStart(2,"0")}</span><span>{chain.name}</span><ArrowUpRight size={17} aria-hidden="true"/></div>
      <h3>{metadata?.collection??shortAddress(collection.address)}</h3>
      <div className="hoj-listed-metrics">
        <div><small>LISTED</small><strong>{collection.listingCount}</strong></div>
        <div><small>SALES</small><strong>{collection.salesCount}</strong></div>
        <div><small>VOLUME</small><strong>{collection.salesVolume > 0n ? formatEther(collection.salesVolume) : "—"} {chain.currency}</strong></div>
        <div><small>{collection.complete?"FLOOR":"LOW"}</small><strong>{formatEther(BigInt(collection.floorPrice))} {chain.currency}<UsdEstimate wei={collection.floorPrice} currency={chain.currency}/></strong></div>
      </div>
    </div>
  </Link>;
}

function DiscoverShowcaseCard({collection,rank}:{collection:ListedCollection;rank:number}) {
  const [metadata,setMetadata]=useState<{collection?:string|null;imageUrl?:string|null;videoUrl?:string|null}|null>(null);
  const [failed,setFailed]=useState(false);
  const [videoFailed,setVideoFailed]=useState(false);
  const chain=getMarketplaceChain(collection.chainId);
  const artworkUrl=`/api/nft-image?chainId=${collection.chainId}&contract=${collection.address}&tokenId=${collection.sampleTokenId}`;
  useEffect(()=>{
    const controller=new AbortController();
    void fetch(`/api/nft?chainId=${collection.chainId}&contract=${collection.address}&tokenId=${collection.sampleTokenId}`,{signal:controller.signal})
      .then(response=>response.ok?response.json() as Promise<{collection?:string|null;imageUrl?:string|null;videoUrl?:string|null}>:null)
      .then(data=>setMetadata(data)).catch(()=>{});
    return()=>controller.abort();
  },[collection.chainId,collection.address,collection.sampleTokenId]);
  return <Link className="discover-showcase-card" href={`/collection/${collection.chainId}/${collection.address}`}>
    {metadata?.videoUrl&&!videoFailed?<video src={metadata.videoUrl} poster={metadata.imageUrl??undefined} muted playsInline preload="metadata" aria-label={metadata.collection??`${chain.name} collection artwork`} style={{width:"100%",height:"100%",objectFit:"cover"}} onError={()=>setVideoFailed(true)}/>:!failed?<Image src={metadata?.imageUrl??artworkUrl} alt={metadata?.collection??`${chain.name} collection artwork`} fill unoptimized sizes="(max-width: 700px) 85vw, 34vw" onError={()=>setFailed(true)}/>:<div className="discover-showcase-fallback"><ImageIcon size={42}/></div>}
    <span className="discover-showcase-shade"/>
    <div className="discover-showcase-top"><span>FEATURED #{rank}</span><span>{chain.name}</span></div>
    <div className="discover-showcase-copy"><h2>{metadata?.collection??shortAddress(collection.address)}</h2><div><span><small>LISTED</small><strong>{collection.listingCount}</strong></span><span><small>FLOOR</small><strong>{formatEther(BigInt(collection.floorPrice))} {chain.currency}<UsdEstimate wei={collection.floorPrice} currency={chain.currency}/></strong></span><span><small>SALES</small><strong>{collection.salesCount}</strong></span></div></div>
  </Link>;
}

function FeaturedArtwork({ listing, onExpand }: { listing: IndexedListing; onExpand: (url: string) => void }) {
  const [failedUrl, setFailedUrl] = useState<string|null>(null);
  const [media,setMedia]=useState<{imageUrl?:string|null;videoUrl?:string|null}|null>(null);
  const imageUrl = `/api/nft-image?chainId=${listing.chainId}&contract=${listing.nftAddress}&tokenId=${listing.tokenId}`;
  const artworkUrl=media?.videoUrl??media?.imageUrl??imageUrl;
  useEffect(()=>{
    const controller=new AbortController();
    void fetch(`/api/nft?chainId=${listing.chainId}&contract=${listing.nftAddress}&tokenId=${listing.tokenId}`,{signal:controller.signal})
      .then(response=>response.ok?response.json() as Promise<{imageUrl?:string|null;videoUrl?:string|null}>:null)
      .then(setMedia).catch(()=>{});
    return()=>controller.abort();
  },[listing.chainId,listing.nftAddress,listing.tokenId]);
  return failedUrl!==artworkUrl
    ? (
      <>
        {media?.videoUrl?<video src={media.videoUrl} poster={media.imageUrl??undefined} muted playsInline preload="metadata" aria-label={`NFT #${listing.tokenId}`} className="royal-featured-artwork" onError={()=>setFailedUrl(artworkUrl)}/>:<img
          src={artworkUrl}
          alt={`NFT #${listing.tokenId}`} 
          loading="lazy" 
          onError={() => setFailedUrl(artworkUrl)}
          className="royal-featured-artwork"
          onClick={(e) => {
            e.preventDefault();
            onExpand(imageUrl);
          }}
          style={{ cursor: 'pointer' }}
        />}
        {!media?.videoUrl&&<button
          className="royal-expand-button"
          onClick={(e) => {
            e.preventDefault();
            onExpand(imageUrl);
          }}
          aria-label="Expand image"
        >
          <Maximize2 size={20} />
        </button>}
      </>
    )
    : <div className="royal-nft-placeholder"><ImageIcon size={36} aria-label="Artwork unavailable" /></div>;
}

const PICK_ROTATION_MS=2*60*60*1000;
const nftKey=(nft:IndexedListing)=>`${nft.nftAddress.toLowerCase()}:${nft.tokenId}`;

function randomFourNfts(listings:IndexedListing[],retained:IndexedListing[]=[]):IndexedListing[] {
  const shuffled=[...listings];
  for(let index=shuffled.length-1;index>0;index--){
    const other=Math.floor(Math.random()*(index+1));
    [shuffled[index],shuffled[other]]=[shuffled[other],shuffled[index]];
  }
  const chosen=[...retained].slice(0,4);
  const keys=new Set(chosen.map(nftKey));
  const collections=new Set(chosen.map(item=>item.nftAddress.toLowerCase()));
  if(chosen.length===4)return chosen;
  for(const listing of shuffled){
    if(keys.has(nftKey(listing)))continue;
    const collection=listing.nftAddress.toLowerCase();
    if(collections.has(collection))continue;
    collections.add(collection);
    keys.add(nftKey(listing));
    chosen.push(listing);
    if(chosen.length===4)return chosen;
  }
  for(const listing of shuffled){
    if(keys.has(nftKey(listing)))continue;
    keys.add(nftKey(listing));
    chosen.push(listing);
    if(chosen.length===4)break;
  }
  return chosen;
}

function DiscoverNftCard({nft,onExpand}:{nft:IndexedListing;onExpand:(url:string)=>void}){
  const [metadata,setMetadata]=useState<{name?:string|null;collection?:string|null}|null>(null);
  const chain=getMarketplaceChain(nft.chainId);
  const href=`/nft/${nft.chainId}/${nft.nftAddress}/${nft.tokenId}${nft.legacy?"?legacy=1":""}`;
  useEffect(()=>{
    const controller=new AbortController();
    void fetch(`/api/nft?chainId=${nft.chainId}&contract=${nft.nftAddress}&tokenId=${nft.tokenId}`,{signal:controller.signal})
      .then(response=>response.ok?response.json() as Promise<{name?:string|null;collection?:string|null}>:null)
      .then(setMetadata).catch(()=>{});
    return()=>controller.abort();
  },[nft.chainId,nft.nftAddress,nft.tokenId]);
  return <div className="nft-card-with-action">
    <Link href={href} className="royal-nft-card">
      <div className="royal-nft-image"><FeaturedArtwork listing={nft} onExpand={onExpand}/><div className="royal-nft-overlay"><span className="royal-quick-view" aria-hidden="true"><Search size={20}/></span></div></div>
      <div className="royal-nft-info">
        <div className="royal-nft-collection"><span>{chain.name}</span><strong>{metadata?.collection??shortAddress(nft.nftAddress)}</strong></div>
        <h3>{metadata?.name??`Token #${nft.tokenId}`}</h3>
        <div className="royal-nft-price"><span>Current Price</span><strong>{formatEther(BigInt(nft.price))} {chain.currency}<UsdEstimate wei={nft.price} currency={chain.currency}/></strong></div>
      </div>
    </Link>
    {BigInt(nft.price)>0n&&<Link className="nft-card-buy-now" href={href}>Buy now <ArrowUpRight size={15}/></Link>}
  </div>;
}

export default function Home() {
  const [listedCollections, setListedCollections] = useState<ListedCollection[]>([]);
  const [featuredNFTs, setFeaturedNFTs] = useState<IndexedListing[]>([]);
  const [randomNftsByChain,setRandomNftsByChain]=useState<Partial<Record<MarketplaceChainId,IndexedListing[]>>>({});
  const latestListings=useRef<IndexedListing[]>([]);
  const pickedKeys=useRef<Record<number,string[]>>({});
  const picksUpdatedAt=useRef(0);
  const [recentActivity, setRecentActivity] = useState<IndexedActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [activeChain,setActiveChain]=useState<MarketplaceChainId|"all">("all");
  useEffect(()=>{
    let saved:MarketplaceChainId|"all"="all";
    try{
      const value=window.sessionStorage.getItem("hoj-marketplace-network");
      if(value==="all")saved="all";
      else if(value&&isMarketplaceChainId(Number(value)))saved=Number(value) as MarketplaceChainId;
    }catch{/* Show all networks when session storage is unavailable. */}
    queueMicrotask(()=>setActiveChain(saved));
  },[]);
  function chooseNetwork(chain:MarketplaceChainId|"all"){
    setActiveChain(chain);
    try{window.sessionStorage.setItem("hoj-marketplace-network",String(chain));}catch{/* The page can still be filtered without storage. */}
  }
  const visibleCollections=listedCollections.filter(collection=>activeChain==="all"||collection.chainId===activeChain);
  const liveChainIds=(Object.keys(marketplaceChains).map(Number) as MarketplaceChainId[]).filter(id=>marketplaceChains[id].marketplaceStatus==="live");
  const visibleChainIds=activeChain==="all"?liveChainIds:liveChainIds.filter(id=>id===activeChain);
  const visibleActivity=recentActivity.filter(item=>activeChain==="all"||item.chainId===activeChain).slice(0,6);

  useEffect(()=>{
    try{
      const saved=JSON.parse(window.sessionStorage.getItem("hoj-discover-picks")??"null") as {at?:number;keys?:Record<number,string[]>}|null;
      if(saved&&typeof saved.at==="number"&&Date.now()-saved.at<PICK_ROTATION_MS&&saved.at<=Date.now()&&saved.keys){
        picksUpdatedAt.current=saved.at;
        pickedKeys.current=saved.keys;
      }
    }catch{/* Start with fresh picks when session storage is unavailable. */}
  },[]);

  const updatePicks=useCallback((listings:IndexedListing[],rotate=false)=>{
    if(!listings.length)return;
    if(rotate||!picksUpdatedAt.current){
      picksUpdatedAt.current=Date.now();
      if(rotate)pickedKeys.current={};
    }
    const next:Partial<Record<MarketplaceChainId,IndexedListing[]>>={};
    const keys:Record<number,string[]>={};
    for(const chainId of (Object.keys(marketplaceChains).map(Number) as MarketplaceChainId[]).filter(id=>marketplaceChains[id].marketplaceStatus==="live")){
      const available=listings.filter(nft=>nft.chainId===chainId);
      if(!available.length){
        next[chainId]=[];
        keys[chainId]=pickedKeys.current[chainId]??[];
        continue;
      }
      const byKey=new Map(available.map(nft=>[nftKey(nft),nft]));
      const retained=(pickedKeys.current[chainId]??[]).map(key=>byKey.get(key)).filter((item):item is IndexedListing=>!!item);
      next[chainId]=randomFourNfts(available,retained);
      keys[chainId]=next[chainId].map(nftKey);
    }
    pickedKeys.current=keys;
    setRandomNftsByChain(next);
    try{window.sessionStorage.setItem("hoj-discover-picks",JSON.stringify({at:picksUpdatedAt.current,keys}));}catch{/* The picks still work without storage. */}
  },[]);

  useEffect(()=>{
    latestListings.current=featuredNFTs;
    updatePicks(featuredNFTs,!!picksUpdatedAt.current&&Date.now()-picksUpdatedAt.current>=PICK_ROTATION_MS);
  },[featuredNFTs,updatePicks]);
  useEffect(()=>{
    const rotateIfDue=()=>{
      if(!document.hidden&&picksUpdatedAt.current&&Date.now()-picksUpdatedAt.current>=PICK_ROTATION_MS)updatePicks(latestListings.current,true);
    };
    const timer=window.setInterval(rotateIfDue,60_000);
    window.addEventListener("focus",rotateIfDue);
    return()=>{window.clearInterval(timer);window.removeEventListener("focus",rotateIfDue);};
  },[updatePicks]);

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
        const res = await fetch(`/api/indexer?chainId=${chainId}`);
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
          <span className="discover-chain-label">Networks</span>
          <button type="button" aria-pressed={activeChain==="all"} onClick={()=>chooseNetwork("all")}>All networks</button>
          {(Object.keys(marketplaceChains).map(Number) as MarketplaceChainId[]).filter(id=>marketplaceChains[id].marketplaceStatus==="live").map(id=><button key={id} type="button" aria-pressed={activeChain===id} onClick={()=>chooseNetwork(id)}>{marketplaceChains[id].name}</button>)}
        </div>
      </section>
      <form action="/search" method="get" className="nft-inline-search discover-nft-search" role="search">
        <Search size={18} aria-hidden="true"/>
        <input type="search" name="q" aria-label="Search all NFTs" placeholder="Search NFTs by name, collection, contract or token ID"/>
        {typeof activeChain==="number"&&<input type="hidden" name="chainId" value={activeChain}/>}
        <button type="submit">Search NFTs</button>
      </form>
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

      {/* Four rotating NFTs from each live network. */}
      {visibleChainIds.map(chainId=>{
        const chain=getMarketplaceChain(chainId);
        const nfts=randomNftsByChain[chainId]??[];
        return <section className="royal-section royal-section-alt royal-featured-section discover-network-section" key={chainId} aria-label={`${chain.name} NFTs`}>
          <div className="royal-section-header">
            <div><span className="royal-section-label">EXPLORE · {chain.name.toUpperCase()}</span><h2>{chain.name} NFTs</h2></div>
            <Link href={`/market?chainId=${chainId}`} className="royal-view-all">View {chain.name} market <ArrowUpRight size={16}/></Link>
          </div>
          {loading?<div className="royal-loading-grid">{[...Array(4)].map((_,index)=><div key={index} className="royal-skeleton-card"/>)}</div>
            :<div className="royal-nfts-grid">{nfts.length?nfts.map(nft=><DiscoverNftCard key={`${nft.id}:${nft.legacy?"legacy":"current"}`} nft={nft} onExpand={setLightboxImage}/>):<p className="royal-market-empty">No active NFTs are available on {chain.name} right now.</p>}</div>}
        </section>;
      })}

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
                    <strong>{activity.price ? formatEther(BigInt(activity.price)) : "0"} {chain.currency}{activity.price&&<UsdEstimate wei={activity.price} currency={chain.currency}/>}</strong>
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
