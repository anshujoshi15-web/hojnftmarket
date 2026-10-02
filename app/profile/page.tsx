"use client";

import { WalletOffers } from "../components/offers-panel";

import { Sparkles, Wallet, TrendingUp, Activity, Gift, ExternalLink, ImageIcon, ArrowUpRight, Mail, Bell } from "lucide-react";
import { useAccount, useChainId } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useState, useEffect } from "react";
import { formatEther } from "viem";
import Link from "next/link";
import { getMarketplaceChain, isMarketplaceChainId, isMarketplaceLive, marketplaceChains, transactionUrl, type MarketplaceChainId } from "@/lib/marketplace-chains";
import { MARKETPLACE_REFRESH_INTERVAL, onMarketplaceUpdate } from "@/lib/marketplace-refresh";
import { ProfileListingFlow } from "../components/profile-listing-flow";

type WalletNft = {
  contractAddress: string;
  tokenId: string;
  tokenType?: string;
  quantity?: string;
  name: string | null;
  collection: string | null;
  imageUrl: string | null;
  description: string | null;
  externalUrl: string | null;
  explorerUrl?: string;
  traits: Array<{ type: string; value: string }>;
  chainId?: number;
};

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
};

type IndexerResponse = {
  listings: IndexedListing[];
  activity: IndexedActivity[];
  configured?: boolean;
  syncError?: string | null;
};

type WalletNftResponse = {
  complete?: boolean;
  coverage?: "indexed-collections";
  nfts?: WalletNft[];
  error?: string;
  warnings?: string[];
  explorerAddressUrl?: string;
};

type ExplorerFallback = {
  chainId: MarketplaceChainId;
  chainName: string;
  url: string;
  reason: string;
};

function NftArtwork({ imageUrl, name }: { imageUrl: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  
  const handleError = () => {
    console.error(`Failed to load image for ${name}:`, imageUrl);
    setFailed(true);
  };
  
  return <div className="royal-nft-image">
    {imageUrl && !failed
      ? <img src={imageUrl} alt={name} loading="lazy" onError={handleError} />
      : <div className="royal-nft-artwork-fallback"><ImageIcon size={30} aria-hidden="true" /><span>Artwork unavailable</span></div>}
  </div>;
}

export default function ProfilePage() {
  const { address } = useAccount();
  const walletChainId = useChainId();
  const [activeTab, setActiveTab] = useState<"portfolio" | "listings" | "offers" | "created" | "activity" | "notifications">("portfolio");
  const [statusFilter, setStatusFilter] = useState<"all" | "listed" | "not-listed">("all");
  const [walletNfts, setWalletNfts] = useState<WalletNft[]>([]);
  const [bulkSelection, setBulkSelection] = useState<{chainId:MarketplaceChainId;collection:string;tokenIds:string[]}|null>(null);
  useEffect(()=>{queueMicrotask(()=>setBulkSelection(null));},[address]);
  const [listings, setListings] = useState<IndexedListing[]>([]);
  const [activity, setActivity] = useState<IndexedActivity[]>([]);
  const [activityFilter, setActivityFilter] = useState<"all"|IndexedActivity["eventType"]>("all");
  const [activityLimit, setActivityLimit] = useState(30);
  const [loading, setLoading] = useState(false);
  const [selectedChain, setSelectedChain] = useState<MarketplaceChainId | "all" | "wallet" | "pick">("pick");
  const [networkSelectionReady,setNetworkSelectionReady]=useState(false);
  const [explorerFallbacks, setExplorerFallbacks] = useState<ExplorerFallback[]>([]);
  const [indexedCoverage, setIndexedCoverage] = useState<string[]>([]);
  const [retry, setRetry] = useState(0);
  const [notificationSettings, setNotificationSettings] = useState({
    email: "",
    emailEnabled: false,
    salesEnabled: true,
    offersEnabled: true
  });

  useEffect(()=>{
    let saved:MarketplaceChainId | "all" | "wallet" | "pick"="pick";
    try{
      const value=window.sessionStorage.getItem("hoj-marketplace-network");
      if(value==="all"||value==="wallet"||value==="pick")saved=value;
      else if(value&&isMarketplaceChainId(Number(value)))saved=Number(value) as MarketplaceChainId;
    }catch{/* A fresh session starts with no network selected. */}
    queueMicrotask(()=>{setSelectedChain(saved);setNetworkSelectionReady(true);});
  },[]);

  function chooseNetwork(value:string){
    const selected=value==="all"||value==="wallet"||value==="pick"?value:Number(value) as MarketplaceChainId;
    if(typeof selected==="number"&&!isMarketplaceChainId(selected))return;
    setSelectedChain(selected);
    try{window.sessionStorage.setItem("hoj-marketplace-network",String(selected));}catch{/* Navigation still works without storage. */}
  }

  useEffect(() => {
    if (!address||!networkSelectionReady) return;
    if(selectedChain==="pick"){
      queueMicrotask(()=>{setWalletNfts([]);setExplorerFallbacks([]);setIndexedCoverage([]);setLoading(false);});
      return;
    }
    let active = true;
    const controller = new AbortController();
    
    async function loadWalletData() {
      if (!address) return;
      
      setLoading(true);
      try {
        // Load notification settings
        try {
          const settingsKey = `hoj:notification-settings:${address.toLowerCase()}`;
          const storedSettings = localStorage.getItem(settingsKey);
          if (storedSettings) {
            setNotificationSettings(JSON.parse(storedSettings));
          }
        } catch (error) {
          console.error("Failed to load notification settings:", error);
        }
        // Show holdings across networks by default, with Shibarium first.
        let chainIds: MarketplaceChainId[] = [];
        if (selectedChain === "all") {
          // Load Shibarium first, then other chains
          const allChains = Object.keys(marketplaceChains).map(Number) as MarketplaceChainId[];
          const shibariumChain = allChains.find(id => id === 109);
          const otherChains = allChains.filter(id => id !== 109);
          chainIds = shibariumChain ? [shibariumChain, ...otherChains] : allChains;
        } else if (selectedChain === "wallet") {
          chainIds = walletChainId in marketplaceChains ? [walletChainId as MarketplaceChainId] : [109];
        } else if(typeof selectedChain==="number") {
          chainIds = [selectedChain];
        }

        // Keep requests below provider rate limits; a single network failure
        // must not prevent already-fetched holdings on other networks.
        const nftResponses: PromiseSettledResult<WalletNftResponse>[] = [];
        for(let offset=0;offset<chainIds.length;offset+=3){
          const batch=await Promise.allSettled(chainIds.slice(offset,offset+3).map(async chainId=>{
            const response=await fetch(`/api/wallet-nfts?owner=${encodeURIComponent(address)}&chainId=${chainId}`,{cache:"no-store",signal:controller.signal});
            const data=await response.json() as WalletNftResponse;
            if(!response.ok&&!data.error)throw new Error(`${getMarketplaceChain(chainId).name} holdings service returned ${response.status}.`);
            return data;
          }));
          nftResponses.push(...batch);
          if(!active)return;
        }
        if (!active) return;

        const allNfts: WalletNft[] = [];
        const failedExplorers: ExplorerFallback[] = [];
        const limitedSources:string[]=[];
        nftResponses.forEach((result, index) => {
          if (result.status === "fulfilled" && result.value) {
            const data = result.value as WalletNftResponse;
            if (data.nfts && data.nfts.length > 0) {
              // Add chainId to each NFT from the response
              const chainId = chainIds[index];
              allNfts.push(...data.nfts.map(nft => ({ ...nft, chainId })));
            }
            if(data.coverage==="indexed-collections"){
              limitedSources.push(getMarketplaceChain(chainIds[index]).name);
            }else if (data.complete === false || data.error) {
              const reason=data.error??data.warnings?.join("; ")??"The NFT provider could not verify the full wallet history.";
              failedExplorers.push({
                chainId: chainIds[index],
                chainName: getMarketplaceChain(chainIds[index]).name,
                url: data.explorerAddressUrl ?? `${getMarketplaceChain(chainIds[index]).explorerUrl}/address/${address}`,
                reason,
              });
            }
          } else if (result.status === "rejected") {
            console.error(`Failed to load NFTs from chain ${chainIds[index]}:`, result.reason);
            failedExplorers.push({
              chainId: chainIds[index],
              chainName: getMarketplaceChain(chainIds[index]).name,
              url: `${getMarketplaceChain(chainIds[index]).explorerUrl}/address/${address}`,
              reason: "The network request failed. Retry this network or use its explorer while the provider recovers.",
            });
          }
        });

        setWalletNfts(allNfts);
        setExplorerFallbacks(failedExplorers);
        setIndexedCoverage(limitedSources);
        setLoading(false);

      } catch (error) {
        if (active) console.error("Failed to load wallet data:", error);
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadWalletData();
    return () => { active = false; controller.abort(); };
  }, [address, selectedChain, walletChainId, retry, networkSelectionReady]);

  useEffect(() => {
    if (!address||!networkSelectionReady||selectedChain==="pick") { queueMicrotask(()=>{setListings([]);setActivity([]);});return; }
    const wallet=address.toLowerCase();
    let active=true,refreshing=false;
    const chainIds=(selectedChain==="all"
      ? Object.keys(marketplaceChains).map(Number)
      : [selectedChain==="wallet"?(walletChainId in marketplaceChains?walletChainId:109):selectedChain]) as MarketplaceChainId[];
    const liveIds=chainIds.filter(id=>marketplaceChains[id].marketplaceStatus==="live");
    const responses=new Map<string,IndexerResponse>();
    async function refresh(onlyChainId?:number){
      if(refreshing)return;
      refreshing=true;
      try{
        await Promise.allSettled(liveIds.filter(id=>onlyChainId===undefined||id===onlyChainId).map(async chainId=>{
          const response=await fetch(`/api/indexer?chainId=${chainId}`);
          if(!response.ok||!active)return;
          const data=await response.json() as IndexerResponse;
          if(!active)return;
          responses.set(`${chainId}:current`,data);
          const all=[...responses.values()];
          setListings(all.flatMap(data=>data.listings??[]).filter(item=>item.seller.toLowerCase()===wallet));
          setActivity(all.flatMap(data=>data.activity??[]).filter(item=>item.seller?.toLowerCase()===wallet||item.buyer?.toLowerCase()===wallet).sort((a,b)=>b.blockNumber-a.blockNumber||b.logIndex-a.logIndex));
        }));
      }finally{refreshing=false;}
    }
    void refresh();
    const timer=window.setInterval(()=>{if(!document.hidden)void refresh();},MARKETPLACE_REFRESH_INTERVAL);
    const onFocus=()=>{if(!document.hidden)void refresh();};
    window.addEventListener("focus",onFocus);
    const unsubscribe=onMarketplaceUpdate(chainId=>{void refresh(chainId);});
    return()=>{active=false;window.clearInterval(timer);window.removeEventListener("focus",onFocus);unsubscribe();};
  },[address,selectedChain,walletChainId,networkSelectionReady]);

  const filteredNfts = walletNfts.filter(nft => {
    const isListed = listings.some(l => 
      l.chainId === nft.chainId &&
      l.nftAddress.toLowerCase() === nft.contractAddress.toLowerCase() && 
      l.tokenId === nft.tokenId
    );
    
    if (statusFilter === "listed") return isListed;
    if (statusFilter === "not-listed") return !isListed;
    return true;
  });

  const activeListingChain = selectedChain === "wallet" && walletChainId in marketplaceChains ? walletChainId as MarketplaceChainId : selectedChain;
  const filteredListings = activeListingChain === "all" 
    ? listings 
    : listings.filter(l => l.chainId === activeListingChain);
  const filteredActivity=activity.filter(item=>activityFilter==="all"||item.eventType===activityFilter);
  const visibleActivity=filteredActivity.slice(0,activityLimit);
  const selectedCount=bulkSelection?.tokenIds.length??0;
  function toggleBulkNft(nft:WalletNft,chainId:MarketplaceChainId,checked:boolean){
    setBulkSelection(current=>{
      const sameCollection=current?.chainId===chainId&&current.collection.toLowerCase()===nft.contractAddress.toLowerCase();
      const tokenIds=sameCollection?current.tokenIds:[];
      const next=checked?[...tokenIds.filter(id=>id!==nft.tokenId),nft.tokenId]:tokenIds.filter(id=>id!==nft.tokenId);
      return next.length?{chainId,collection:nft.contractAddress,tokenIds:next}:null;
    });
  }

  if (!address) {
    return (
      <main className="royal-page">
        <section className="royal-page-hero">
          <div className="royal-badge">
            <Wallet size={16} />
            <span>Profile</span>
          </div>
          <h1>Your Royal Profile</h1>
          <p>Connect your wallet to view your profile and manage your NFTs.</p>
        </section>

        <section className="royal-content">
          <div className="royal-empty-state">
            <Wallet size={48} />
            <h2>Connect Your Wallet</h2>
            <p>Connect your wallet to view your profile and manage your NFTs.</p>
            <ConnectButton.Custom>
              {({ openConnectModal }) => (
                <button onClick={openConnectModal} className="royal-primary-button royal-profile-connect-button">
                  Connect Wallet
                  <Wallet size={18} />
                </button>
              )}
            </ConnectButton.Custom>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="royal-page">
      <section className="royal-profile-header">
        <div className="royal-profile-info">
          <div className="royal-wallet-address">
            <Wallet size={20} />
            <span>{address.slice(0, 6)}…{address.slice(-4)}</span>
          </div>
          <Link href="/wallet" className="hoj-profile-withdraw-link">View withdrawable balance <ArrowUpRight size={15}/></Link>
          <div className="royal-portfolio-value">
            <span>Wallet status</span>
            <strong>Connected</strong>
          </div>
        </div>
        <div className="royal-profile-stats">
          <div>
            <strong>{walletNfts.length}</strong>
            <span>NFTs</span>
          </div>
          <div>
            <strong>{listings.length}</strong>
            <span>Listed</span>
          </div>
          <div>
            <strong>{activity.length}</strong>
            <span>Activity</span>
          </div>
        </div>
      </section>

      <section className="royal-profile-tabs">
        <button 
          className={activeTab === "portfolio" ? "active" : ""} 
          onClick={() => setActiveTab("portfolio")}
        >
          Portfolio
        </button>
        <button 
          className={activeTab === "listings" ? "active" : ""} 
          onClick={() => setActiveTab("listings")}
        >
          Listings
        </button>
        <button 
          className={activeTab === "offers" ? "active" : ""} 
          onClick={() => setActiveTab("offers")}
        >
          Offers
        </button>
        <button 
          className={activeTab === "created" ? "active" : ""} 
          onClick={() => setActiveTab("created")}
        >
          Created
        </button>
        <button 
          className={activeTab === "activity" ? "active" : ""} 
          onClick={() => setActiveTab("activity")}
        >
          Activity
        </button>
        <button 
          className={activeTab === "notifications" ? "active" : ""} 
          onClick={() => setActiveTab("notifications")}
        >
          Notifications
        </button>
      </section>

      <section className="royal-profile-filters">
        <div className="royal-filter-group">
          <span>Holdings network</span>
          <select 
            value={selectedChain} 
            onChange={(e) => chooseNetwork(e.target.value)}
          >
            <option value="pick">Pick one</option>
            <option value="wallet">Wallet network</option>
            <option value="all">All Networks</option>
            {Object.entries(marketplaceChains).map(([id, chain]) => (
              <option key={id} value={id}>{chain.name}{chain.marketplaceStatus==="live"?"":" · Trading soon"}</option>
            ))}
          </select>
        </div>
        {activeTab==="portfolio"&&<div className="royal-filter-group">
          <span>Status</span>
          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value as "all" | "listed" | "not-listed")}
          >
            <option value="all">All</option>
            <option value="listed">Listed</option>
            <option value="not-listed">Not Listed</option>
          </select>
        </div>}
      </section>

      <section className="royal-profile-content">
        {activeTab==="portfolio"&&indexedCoverage.length>0&&<p className="royal-holdings-coverage-note">{indexedCoverage.join(", ")} NFTs are shown from indexed collections. Some collections may not appear without a dedicated wallet indexer.</p>}
        {activeTab==="portfolio"&&explorerFallbacks.length > 0 && (
          <div className="royal-explorer-fallbacks" role="status">
            <div>
              <strong>Holdings could not be fully verified on {explorerFallbacks.map(item=>item.chainName).join(", ")}</strong>
              <button type="button" disabled={loading} onClick={() => setRetry(value => value + 1)}>{loading ? "Retrying…" : "Retry missing networks"}</button>
              <p>NFTs we found are shown below. Missing items may appear after the provider recovers; this warning does not mean your wallet is empty.</p>
            </div>
            <div className="royal-explorer-links">
              {explorerFallbacks.map((fallback) => (
                <a key={fallback.chainId} href={fallback.url} target="_blank" rel="noreferrer">
                  {fallback.chainName} · View on explorer
                  <ExternalLink size={14} aria-hidden="true" />
                </a>
              ))}
            </div>
            <ul>{explorerFallbacks.map(fallback=><li key={fallback.chainId}><strong>{fallback.chainName}:</strong> {fallback.reason}</li>)}</ul>
          </div>
        )}
        {loading ? (
          <div className="royal-loading-grid">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="royal-skeleton-card" />
            ))}
          </div>
        ) : (
          <>
            {activeTab === "portfolio" && (
              <><div className="royal-portfolio-grid">
                {filteredNfts.length > 0 ? (
                  filteredNfts.map((nft) => {
                    const nftChainId = nft.chainId || 109; // Default to Shibarium if not set
                    const activeListing=listings.find(l=>l.chainId===nftChainId&&l.nftAddress.toLowerCase()===nft.contractAddress.toLowerCase()&&l.tokenId===nft.tokenId);
                    const tokenStandard=(nft.tokenType??"ERC-721").toUpperCase().replace(/[^A-Z0-9]/g,"");
                    const isEdition=tokenStandard==="ERC1155"||tokenStandard==="CRC1155";
                    const selectionReason=isEdition?"Bulk selection supports ERC-721 NFTs only. Open this NFT to list editions.":activeListing?"This NFT is already listed.":!isMarketplaceChainId(nftChainId)||!isMarketplaceLive(nftChainId)?`Bulk listing is not live on ${getMarketplaceChain(nftChainId).name}.`:null;
                    const selected=bulkSelection?.chainId===nftChainId&&bulkSelection.collection.toLowerCase()===nft.contractAddress.toLowerCase()&&bulkSelection.tokenIds.includes(nft.tokenId);
                    
                    return (
                      <div key={`${nftChainId}-${nft.contractAddress}-${nft.tokenId}`} className="royal-profile-nft-choice"><Link href={`/nft/${nftChainId}/${nft.contractAddress}/${nft.tokenId}?from=profile`} className="royal-profile-nft">
                        <NftArtwork key={nft.imageUrl ?? "no-image"} imageUrl={nft.imageUrl} name={nft.name || `Token #${nft.tokenId}`} />
                        <div className="royal-nft-details">
                          <small>{getMarketplaceChain(nftChainId).name} · {nft.collection || `${nft.contractAddress.slice(0, 8)}…`}</small>
                          <h3>{nft.name || `Token #${nft.tokenId}`}</h3>
                          <div className="royal-nft-status">
                            {activeListing ? (
                              <span className="listed">Listed · {formatEther(BigInt(activeListing.price))} {getMarketplaceChain(nftChainId).currency}</span>
                            ) : (
                              <span className="not-listed">Not Listed</span>
                            )}
                          </div>
                        </div>
                      </Link><label className="royal-profile-select" title={selectionReason??"Select for listing"}><input type="checkbox" aria-label={selectionReason??`Select ${nft.name||`token #${nft.tokenId}`} for listing`} checked={!!selected} disabled={!!selectionReason||(selectedCount>=20&&!selected)} onChange={event=>{if(isMarketplaceChainId(nftChainId))toggleBulkNft(nft,nftChainId,event.target.checked);}}/></label></div>
                    );
                  })
                ) : (
                  <div className="royal-empty-state">
                    <ImageIcon size={48} />
                    <h2>{selectedChain==="pick"?"Pick a network":"No NFTs Found"}</h2>
                    <p>{selectedChain==="pick"?"Choose a holdings network above to view your NFTs.":"Try adjusting your filters or connect a different wallet."}</p>
                  </div>
                )}
              </div></>
            )}

            {activeTab === "listings" && (
              <div className="royal-listings-grid">
                {filteredListings.length > 0 ? (
                  filteredListings.map((listing) => {
                    const chain = getMarketplaceChain(listing.chainId);
                    return (
                      <div key={listing.id} className="royal-listing-card">
                        <div className="royal-listing-price">
                          <span>Price</span>
                          <strong>{formatEther(BigInt(listing.price))} {chain.currency}</strong>
                        </div>
                        <div className="royal-listing-details">
                          <small>{chain.name}</small>
                          <h3>#{listing.tokenId}</h3><Link href={`/nft/${listing.chainId}/${listing.nftAddress}/${listing.tokenId}?from=profile`}>Manage listing</Link>
                          <p>{listing.nftAddress.slice(0, 8)}…</p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="royal-empty-state">
                    <ImageIcon size={48} />
                    <h2>No Active Listings</h2>
                    <p>List your NFTs to see them here.</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === "activity" && (
              <div className="profile-activity-layout">
                <aside className="profile-activity-sidebar"><h2>Status</h2><div className="profile-activity-chips">{([ ["all","All"],["sold","Sale"],["listed","Listing"],["canceled","Cancellation"],["withdrawn","Withdrawal"] ] as const).map(([value,label])=><button key={value} type="button" className={activityFilter===value?"active":""} aria-pressed={activityFilter===value} onClick={()=>{setActivityFilter(value);setActivityLimit(30);}}>{label}</button>)}</div><p>Confirmed activity on House of Joshi marketplace contracts.</p></aside>
                <div className="profile-activity-main">
                  <div className="profile-activity-table" role="table" aria-label="Marketplace activity">
                    <div className="profile-activity-table-head" role="row"><span>Event</span><span>Item</span><span>Price</span><span>From</span><span>To</span><span>Network / Block</span></div>
                    {visibleActivity.map(item=>{
                      const chain=getMarketplaceChain(item.chainId);
                      const nft=item.nftAddress&&item.tokenId?walletNfts.find(held=>held.chainId===item.chainId&&held.contractAddress.toLowerCase()===item.nftAddress?.toLowerCase()&&held.tokenId===item.tokenId):null;
                      const imageUrl=item.nftAddress&&item.tokenId?nft?.imageUrl??`/api/nft-image?${new URLSearchParams({chainId:String(item.chainId),contract:item.nftAddress,tokenId:item.tokenId})}`:null;
                      const label={listed:"Listing",sold:"Sale",canceled:"Cancellation",withdrawn:"Withdrawal"}[item.eventType];
                      return <div key={item.id} className="profile-activity-table-row" role="row">
                        <div className="profile-activity-event"><span className={`profile-activity-event-icon ${item.eventType}`}>{item.eventType==="sold"?<TrendingUp size={17}/>:item.eventType==="listed"?<Gift size={17}/>:<Activity size={17}/>}</span><strong>{label}</strong></div>
                        <div className="profile-activity-item">{item.nftAddress&&item.tokenId?<><NftArtwork imageUrl={imageUrl} name={nft?.name??`Token #${item.tokenId}`}/><Link href={`/nft/${item.chainId}/${item.nftAddress}/${item.tokenId}?from=profile`}>{nft?.name??`Token #${item.tokenId}`}<small>{nft?.collection??`${item.nftAddress.slice(0,6)}…${item.nftAddress.slice(-4)}`}</small></Link></>:<span>Marketplace proceeds</span>}</div>
                        <span className="profile-activity-price">{item.price?`${formatEther(BigInt(item.price))} ${chain.currency}`:"—"}</span>
                        <span className="profile-activity-address">{item.seller?item.seller.toLowerCase()===address.toLowerCase()?"You":`${item.seller.slice(0,6)}…${item.seller.slice(-4)}`:"—"}</span>
                        <span className="profile-activity-address">{item.buyer?item.buyer.toLowerCase()===address.toLowerCase()?"You":`${item.buyer.slice(0,6)}…${item.buyer.slice(-4)}`:"—"}</span>
                        <a className="profile-activity-block" href={transactionUrl(item.chainId,item.transactionHash)} target="_blank" rel="noreferrer" aria-label={`View ${label.toLowerCase()} transaction on ${chain.name} explorer`}>{chain.name}<small>Block {item.blockNumber} ↗</small></a>
                      </div>;
                    })}
                  </div>
                  {filteredActivity.length===0&&<div className="royal-empty-state"><Activity size={48}/><h2>No {activityFilter==="all"?"Activity":`${activityFilter} Activity`} Yet</h2><p>Confirmed marketplace events will appear here.</p></div>}
                  {filteredActivity.length>activityLimit&&<button type="button" className="profile-activity-more" onClick={()=>setActivityLimit(limit=>limit+30)}>Show more activity</button>}
                </div>
              </div>
            )}

            {activeTab === "offers" && <WalletOffers/>}

            {activeTab === "created" && (
              <div className="royal-empty-state">
                <Sparkles size={64} />
                <h2>No Created NFTs</h2>
                <p>NFTs you create will appear here.</p>
              </div>
            )}

            {activeTab === "notifications" && (
              <div className="royal-notifications-section">
                <div className="royal-email-settings">
                  <h3><Mail size={20} /> Email Notifications</h3>
                  <p>Receive email notifications when your NFTs are sold or when you receive offers.</p>
                  
                  <div className="royal-notification-inputs">
                    <label>
                      <span>Email Address</span>
                      <input
                        type="email"
                        placeholder="your@email.com"
                        value={notificationSettings.email}
                        onChange={(e) => setNotificationSettings(prev => ({ ...prev, email: e.target.value }))}
                      />
                    </label>
                    
                    <label className="royal-notification-toggle">
                      <input
                        type="checkbox"
                        checked={notificationSettings.emailEnabled}
                        onChange={(e) => setNotificationSettings(prev => ({ ...prev, emailEnabled: e.target.checked }))}
                      />
                      <span>Enable email notifications</span>
                    </label>
                    
                    <label className="royal-notification-toggle">
                      <input
                        type="checkbox"
                        checked={notificationSettings.salesEnabled}
                        onChange={(e) => setNotificationSettings(prev => ({ ...prev, salesEnabled: e.target.checked }))}
                      />
                      <span>Notify me when my NFTs sell</span>
                    </label>
                    
                    <label className="royal-notification-toggle">
                      <input
                        type="checkbox"
                        checked={notificationSettings.offersEnabled}
                        onChange={(e) => setNotificationSettings(prev => ({ ...prev, offersEnabled: e.target.checked }))}
                      />
                      <span>Notify me about new offers</span>
                    </label>
                  </div>
                  
                  <button 
                    className="royal-primary-button"
                    onClick={async () => {
                      try {
                        // Save to localStorage
                        const settingsKey = `hoj:notification-settings:${address.toLowerCase()}`;
                        const settingsToSave = {
                          ...notificationSettings,
                          updatedAt: new Date().toISOString()
                        };
                        localStorage.setItem(settingsKey, JSON.stringify(settingsToSave));
                        
                        // Also save to API for future database integration
                        const response = await fetch('/api/notifications/settings', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            walletAddress: address,
                            ...notificationSettings
                          })
                        });
                        
                        if (response.ok) {
                          alert('Notification settings saved successfully!');
                        } else {
                          alert('Notification settings saved locally (API failed).');
                        }
                      } catch (error) {
                        console.error('Failed to save notification settings:', error);
                        alert('Failed to save notification settings.');
                      }
                    }}
                  >
                    Save Notification Settings
                  </button>
                </div>
                
                <div className="royal-notification-info">
                  <h3><Bell size={20} /> Notification Information</h3>
                  <ul>
                    <li><strong>Purchase Notifications:</strong> Confirmed purchases made through this site appear in the notification bell on this device.</li>
                    <li><strong>Sale Notifications:</strong> You&apos;ll receive an email when your listed NFT is sold</li>
                    <li><strong>Offer Notifications:</strong> Get notified when someone makes an offer on your NFT</li>
                    <li><strong>Transaction Details:</strong> Each email includes price, buyer, and transaction links</li>
                    <li><strong>Privacy:</strong> Your email is only used for marketplace notifications</li>
                  </ul>
                </div>
              </div>
            )}
          </>
        )}
      </section>
      {bulkSelection&&<ProfileListingFlow key={`${bulkSelection.chainId}:${bulkSelection.collection.toLowerCase()}`} chainId={bulkSelection.chainId} collection={bulkSelection.collection} items={bulkSelection.tokenIds.map(tokenId=>walletNfts.find(nft=>nft.chainId===bulkSelection.chainId&&nft.contractAddress.toLowerCase()===bulkSelection.collection.toLowerCase()&&nft.tokenId===tokenId)).filter((nft):nft is WalletNft=>!!nft)} onRemove={tokenId=>setBulkSelection(current=>{const remaining=current?.tokenIds.filter(id=>id!==tokenId)??[];return current&&remaining.length?{...current,tokenIds:remaining}:null;})} onClear={()=>setBulkSelection(null)}/>}
    </main>
  );
}
