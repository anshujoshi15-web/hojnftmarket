"use client";

import { BarChart3 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { formatEther } from "viem";
import { getMarketplaceChain, marketplaceChains, type MarketplaceChainId } from "@/lib/marketplace-chains";
import { MARKETPLACE_REFRESH_INTERVAL, onMarketplaceUpdate } from "@/lib/marketplace-refresh";

type Listing={chainId:MarketplaceChainId;nftAddress:string;price:string};
type Activity={chainId:MarketplaceChainId;eventType:string;nftAddress:string|null;price:string|null};
type IndexerData={listings?:Listing[];activity?:Activity[]};

export default function StatsPage(){
  const[listings,setListings]=useState<Listing[]>([]);const[activity,setActivity]=useState<Activity[]>([]);const[loading,setLoading]=useState(true);
  useEffect(()=>{
    let active=true,refreshing=false;
    const responses=new Map<MarketplaceChainId,IndexerData>();
    const chainIds=(Object.keys(marketplaceChains).map(Number) as MarketplaceChainId[]).filter(id=>marketplaceChains[id].marketplaceStatus==="live");
    async function refresh(onlyChainId?:number){
      if(refreshing)return;
      refreshing=true;
      try{
        await Promise.allSettled(chainIds.filter(id=>onlyChainId===undefined||id===onlyChainId).map(async chainId=>{
          const response=await fetch(`/api/indexer?chainId=${chainId}`,{cache:"no-store"});
          if(!response.ok||!active)return;
          const data=await response.json() as IndexerData;
          if(!active)return;
          responses.set(chainId,data);
          setListings([...responses.values()].flatMap(data=>data.listings??[]));
          setActivity([...responses.values()].flatMap(data=>data.activity??[]));
          setLoading(false);
        }));
      }finally{refreshing=false;if(active)setLoading(false);}
    }
    void refresh();
    const timer=window.setInterval(()=>{if(!document.hidden)void refresh();},MARKETPLACE_REFRESH_INTERVAL);
    const onFocus=()=>{if(!document.hidden)void refresh();};
    window.addEventListener("focus",onFocus);
    const unsubscribe=onMarketplaceUpdate(chainId=>{void refresh(chainId);});
    return()=>{active=false;window.clearInterval(timer);window.removeEventListener("focus",onFocus);unsubscribe();};
  },[]);
  const sales=useMemo(()=>activity.filter(item=>(["sold","offer_accepted"].includes(item.eventType))&&item.price),[activity]);
  const collections=useMemo(()=>new Set([...listings.map(item=>`${item.chainId}:${item.nftAddress.toLowerCase()}`),...activity.flatMap(item=>item.nftAddress?[`${item.chainId}:${item.nftAddress.toLowerCase()}`]:[])]),[listings,activity]);
  const chainRows=useMemo(()=>(Object.keys(marketplaceChains).map(Number) as MarketplaceChainId[]).map(chainId=>{const chainSales=sales.filter(item=>item.chainId===chainId);return{chainId,listings:listings.filter(item=>item.chainId===chainId).length,sales:chainSales.length,volume:chainSales.reduce((sum,item)=>sum+BigInt(item.price??"0"),0n)};}),[listings,sales]);
  return <main className="royal-page"><section className="royal-page-hero"><div className="royal-badge"><BarChart3 size={16}/><span>Statistics</span></div><h1>Marketplace Statistics</h1><p>Confirmed listings and sales from House of Joshi contracts across supported networks.</p></section><section className="royal-content">{loading?<div className="royal-loading-grid">{[...Array(4)].map((_,i)=><div key={i} className="royal-skeleton-card"/>)}</div>:<><div className="royal-stats-grid"><div className="royal-stat-card"><h3>Active Listings</h3><p>{listings.length.toLocaleString()}</p></div><div className="royal-stat-card"><h3>Confirmed Sales</h3><p>{sales.length.toLocaleString()}</p></div><div className="royal-stat-card"><h3>Indexed Collections</h3><p>{collections.size.toLocaleString()}</p></div><div className="royal-stat-card"><h3>Supported Networks</h3><p>{Object.keys(marketplaceChains).length}</p></div></div><div className="royal-stats-table"><div className="royal-stats-row header"><span>Network</span><span>Listings</span><span>Sales</span><span>Volume</span></div>{chainRows.map(row=>{const chain=getMarketplaceChain(row.chainId);return <div className="royal-stats-row" key={row.chainId}><strong>{chain.name}</strong><span>{row.listings}</span><span>{row.sales}</span><span>{formatEther(row.volume)} {chain.currency}</span></div>;})}</div></>}</section></main>;
}
