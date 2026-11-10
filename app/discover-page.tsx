"use client";

import { ArrowUpRight, Search, ImageIcon, Maximize2, X } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatEther } from "viem";
import { getMarketplaceChain, isMarketplaceChainId, marketplaceChains, type MarketplaceChainId } from "@/lib/marketplace-chains";
import { DISCOVER_REFRESH_INTERVAL, onMarketplaceUpdate } from "@/lib/marketplace-refresh";
import { UsdEstimate } from "./components/usd-estimate";
import AstralsDiscoverDrop from "./components/astrals-discover-drop";
import { NftCardVideo } from "./components/nft-card-video";

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

type IndexerResponse = {
  chainId: MarketplaceChainId;
  configured: boolean;
  legacy?: boolean;
  stale?: boolean;
  verifiedAt?: number;
  listings: IndexedListing[];
  syncError?: string | null;
};

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function FeaturedArtwork({ listing, media, metadataLoaded, onExpand }: { listing: IndexedListing; media:{imageUrl?:string|null;videoUrl?:string|null}|null; metadataLoaded:boolean; onExpand: (url: string) => void }) {
  const [failedUrls,setFailedUrls]=useState<string[]>([]);
  const resolver=`/api/nft-image?chainId=${listing.chainId}&contract=${listing.nftAddress}&tokenId=${listing.tokenId}`;
  const video=media?.videoUrl&&!failedUrls.includes(media.videoUrl)?media.videoUrl:null;
  const image=[media?.imageUrl,resolver].find(url=>url&&!failedUrls.includes(url));
  const fail=(url:string)=>setFailedUrls(current=>current.includes(url)?current:[...current,url]);
  if(video)return <NftCardVideo src={video} poster={media?.imageUrl} label={`NFT #${listing.tokenId}`} className="royal-featured-artwork" onError={()=>fail(video)}/>;
  if(!image)return <div className="royal-nft-placeholder"><ImageIcon size={36} aria-label={metadataLoaded?"Artwork unavailable":"Loading artwork"}/></div>;
  return <>
    <Image src={image} alt={`NFT #${listing.tokenId}`} fill unoptimized sizes="(max-width: 620px) 90vw, (max-width: 1100px) 45vw, 25vw" className="royal-featured-artwork" onError={()=>fail(image)}/>
    <button type="button" className="royal-expand-button" onClick={event=>{event.preventDefault();onExpand(image);}} aria-label="Expand image"><Maximize2 size={20}/></button>
  </>;
}

const PICK_ROTATION_MS=2*60*60*1000;
const nftKey=(nft:IndexedListing)=>`${nft.legacy?"legacy":"current"}:${nft.id}`;

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
  const [metadata,setMetadata]=useState<{name?:string|null;collection?:string|null;imageUrl?:string|null;videoUrl?:string|null}|null>(null);
  const [metadataLoaded,setMetadataLoaded]=useState(false);
  const chain=getMarketplaceChain(nft.chainId);
  const href=`/nft/${nft.chainId}/${nft.nftAddress}/${nft.tokenId}${nft.legacy?"?legacy=1":""}`;
  useEffect(()=>{
    const controller=new AbortController();
    queueMicrotask(()=>setMetadataLoaded(false));
    void fetch(`/api/nft?chainId=${nft.chainId}&contract=${nft.nftAddress}&tokenId=${nft.tokenId}`,{signal:controller.signal})
      .then(response=>response.ok?response.json() as Promise<{name?:string|null;collection?:string|null;imageUrl?:string|null;videoUrl?:string|null}>:null)
      .then(data=>{setMetadata(data);setMetadataLoaded(true);}).catch(()=>{if(!controller.signal.aborted)setMetadataLoaded(true);});
    return()=>controller.abort();
  },[nft.chainId,nft.nftAddress,nft.tokenId]);
  return <div className="nft-card-with-action">
    <Link href={href} className="royal-nft-card">
      <div className="royal-nft-image"><FeaturedArtwork listing={nft} media={metadata} metadataLoaded={metadataLoaded} onExpand={onExpand}/><div className="royal-nft-overlay"><span className="royal-quick-view" aria-hidden="true"><Search size={20}/></span></div></div>
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
  const [featuredNFTs, setFeaturedNFTs] = useState<IndexedListing[]>([]);
  const [randomNftsByChain,setRandomNftsByChain]=useState<Partial<Record<MarketplaceChainId,IndexedListing[]>>>({});
  const [visibleCountByChain,setVisibleCountByChain]=useState<Partial<Record<MarketplaceChainId,number>>>({});
  const [verifiedByChain,setVerifiedByChain]=useState<Partial<Record<MarketplaceChainId,number>>>({});
  const [feedIssues,setFeedIssues]=useState<Record<string,string|undefined>>({});
  const [loadedChains,setLoadedChains]=useState<number[]>([]);
  const retryListings = useRef<(chainId?: number) => void>(() => {});
  const latestListings=useRef<IndexedListing[]>([]);
  const pickedKeys=useRef<Record<number,string[]>>({});
  const picksUpdatedAt=useRef(0);
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
  const liveChainIds=(Object.keys(marketplaceChains).map(Number) as MarketplaceChainId[]).filter(id=>marketplaceChains[id].marketplaceStatus==="live");
  const visibleChainIds=activeChain==="all"?liveChainIds:liveChainIds.filter(id=>id===activeChain);
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
    const feeds:Array<{chainId:MarketplaceChainId;legacy:boolean}>=liveChains.map(chainId=>({chainId,legacy:false}));
    feeds.push(...liveChains.map(chainId=>({chainId,legacy:true})));

    function renderMarketplaceData() {
      const listings: IndexedListing[] = [];
      const verified: Partial<Record<MarketplaceChainId, number>> = {};
      for (const data of responses.values()) {
        if (!data.configured || data.stale) continue;
        if (!data.legacy && data.verifiedAt) verified[data.chainId] = data.verifiedAt;
        listings.push(...data.listings);
      }
      setVerifiedByChain(verified);
      setFeaturedNFTs(listings.sort((a, b) => b.updatedBlock - a.updatedBlock));
    }

    async function loadMarketplaceData(onlyChainId?: number) {
      if (refreshing) { refreshAgain = true; return; }
      refreshing = true;
      try {
      await Promise.allSettled(feeds.filter(feed => onlyChainId === undefined || feed.chainId === onlyChainId).map(async ({chainId,legacy}) => {
        const feedKey = `${chainId}:${legacy ? "legacy" : "current"}`;
        try {
          const res = await fetch(`/api/indexer?chainId=${chainId}&view=discover${legacy ? "&legacy=1" : ""}`, { cache: "no-store" });
          const data = await res.json() as IndexerResponse;
          if (!mounted) return;
          const issue = legacy && res.status === 404 ? undefined
            : data.stale ? "Live verification is unavailable. Retry to check for active listings."
            : data.syncError ?? (!res.ok ? "Listings could not be loaded. Please retry." : undefined);
          setFeedIssues(current => ({ ...current, [feedKey]: issue }));
          if (res.ok) responses.set(feedKey, data);
          else responses.delete(feedKey);
          renderMarketplaceData();
        } catch {
          if (!mounted) return;
          responses.delete(feedKey);
          setFeedIssues(current => ({ ...current, [feedKey]: "Listings could not be loaded. Please retry." }));
          renderMarketplaceData();
        }
        finally { if(mounted&&!legacy)setLoadedChains(current=>current.includes(chainId)?current:[...current,chainId]); }
      }));
      if (mounted) setLoading(false);
      } finally { refreshing = false; if (refreshAgain && mounted) { refreshAgain = false; void loadMarketplaceData(); } }
    }

    retryListings.current = loadMarketplaceData;
    void loadMarketplaceData();
    let lastRefresh=Date.now();
    const timer = window.setInterval(() => { if (!document.hidden) {lastRefresh=Date.now();void loadMarketplaceData();} }, DISCOVER_REFRESH_INTERVAL);
    const onFocus = () => { if (!document.hidden&&Date.now()-lastRefresh>=DISCOVER_REFRESH_INTERVAL) {lastRefresh=Date.now();void loadMarketplaceData();} };
    window.addEventListener("focus", onFocus);
    const unsubscribe = onMarketplaceUpdate(chainId => { void loadMarketplaceData(chainId); });
    return () => { mounted = false; window.clearInterval(timer); window.removeEventListener("focus", onFocus); unsubscribe(); };
  }, []);

  return (
    <main className="royal-homepage discover-page">
      <section className="discover-intro">
        <div className="discover-intro-head">
          <h1>Discover</h1>
          <form action="/search" method="get" className="nft-inline-search discover-nft-search" role="search">
            <Search size={18} aria-hidden="true"/>
            <input type="search" name="q" aria-label={activeChain==="all"?"Search all NFTs":`Search ${getMarketplaceChain(activeChain).name} NFTs`} placeholder="Search collections or tokens…"/>
            {typeof activeChain==="number"&&<input type="hidden" name="chainId" value={activeChain}/>}
            <button type="submit" aria-label="Search NFTs"><ArrowUpRight size={17} aria-hidden="true" /></button>
          </form>
        </div>
      </section>

      <AstralsDiscoverDrop />

      <section className="discover-listings" aria-labelledby="available-nfts">
        <div className="discover-listings-heading">
          <h2 id="available-nfts">Available NFTs</h2>
          <Link href="/market" className="royal-view-all">Explore market <ArrowUpRight size={16} aria-hidden="true" /></Link>
        </div>
        <div className="discover-chain-pills" role="group" aria-label="Filter by network">
          <span className="discover-chain-label">Networks</span>
          <button type="button" aria-pressed={activeChain==="all"} onClick={()=>chooseNetwork("all")}>All networks</button>
          {(Object.keys(marketplaceChains).map(Number) as MarketplaceChainId[]).filter(id=>marketplaceChains[id].marketplaceStatus==="live").map(id=><button key={id} type="button" aria-pressed={activeChain===id} onClick={()=>chooseNetwork(id)}>{marketplaceChains[id].name}</button>)}
        </div>

        {activeChain === "all" && !featuredNFTs.length && (
          <div className="royal-section royal-market-empty" role="status">
            <p>{loading ? "Checking for available NFTs…" : Object.values(feedIssues).some(Boolean) ? "No active listings could be verified. Some networks are unavailable." : "No NFTs are currently listed for sale."}</p>
            {!loading && Object.values(feedIssues).some(Boolean) && <button type="button" className="royal-view-all" onClick={() => retryListings.current()}>Retry listings</button>}
          </div>
        )}

        {visibleChainIds.map(chainId=>{
          const chain=getMarketplaceChain(chainId);
          const chainListings = featuredNFTs.filter(item => item.chainId === chainId);
          if (activeChain === "all" && !chainListings.length) return null;
          const byKey = new Map(chainListings.map(nft => [nftKey(nft), nft]));
          const picks = (randomNftsByChain[chainId] ?? []).flatMap(nft => {
            const current = byKey.get(nftKey(nft));
            return current ? [current] : [];
          });
          const picked=new Set(picks.map(nftKey));
          const allNfts=[...picks,...chainListings.filter(item=>!picked.has(nftKey(item)))];
          const count=visibleCountByChain[chainId]??3;
          const nfts=allNfts.slice(0,count);
          const feedIssue=feedIssues[`${chainId}:current`]??feedIssues[`${chainId}:legacy`];
          const chainLoading=!loadedChains.includes(chainId)&&!allNfts.length;
          const verifiedAt=verifiedByChain[chainId];
          return <section className="royal-section royal-section-alt royal-featured-section discover-network-section" key={chainId} aria-label={`${chain.name} NFTs`}>
            <div className="royal-section-header">
              <div><span className="royal-section-label">EXPLORE · {chain.name.toUpperCase()}</span><h2>{chain.name} NFTs</h2></div>
              <Link href={`/market?chainId=${chainId}`} className="royal-view-all">View {chain.name} market <ArrowUpRight size={16}/></Link>
            </div>
            {verifiedAt&&<p className="discover-shelf-note">Current marketplace checked <time dateTime={new Date(verifiedAt).toISOString()}>{new Date(verifiedAt).toLocaleString()}</time></p>}
            {!loading&&feedIssue&&<button type="button" className="royal-view-all" onClick={()=>retryListings.current(chainId)}>Retry {chain.name} listings</button>}
            {chainLoading?<div className="royal-loading-grid">{[...Array(4)].map((_,index)=><div key={index} className="royal-skeleton-card"/>)}</div>
              :<><div className="royal-nfts-grid">{nfts.map(nft=><DiscoverNftCard key={`${nft.id}:${nft.legacy?"legacy":"current"}`} nft={nft} onExpand={setLightboxImage}/>)}{!nfts.length&&<p className="royal-market-empty">{feedIssue??`No active House of Joshi listings on ${chain.name} right now.`}</p>}</div>{nfts.length>0&&feedIssue&&<p className="royal-market-empty" role="status">{feedIssue}</p>}{allNfts.length>nfts.length&&<button type="button" className="royal-view-all" onClick={()=>setVisibleCountByChain(current=>({...current,[chainId]:(current[chainId]??3)+12}))}>Show more {chain.name} NFTs ({nfts.length} of {allNfts.length}) <ArrowUpRight size={16}/></button>}</>}
        </section>;
      })}

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
