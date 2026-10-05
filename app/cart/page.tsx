"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { Search, ShoppingCart, Trash2 } from "lucide-react";
import { formatEther } from "viem";
import { marketplaceChains, type MarketplaceChainId } from "@/lib/marketplace-chains";
import { UsdEstimate } from "../components/usd-estimate";
import { matchesNftQuery } from "@/lib/nft-search";

type Listing={id:string;chainId:MarketplaceChainId;nftAddress:string;tokenId:string;price:string};
type Group={chainId:MarketplaceChainId;name:string;currency:string;ids:string[];listings:Listing[];loading:boolean;error:string};

export default function CartPage(){
  const[groups,setGroups]=useState<Group[]>([]);
  const[query,setQuery]=useState("");
  useEffect(()=>{
    let active=true;
    const initial=Object.values(marketplaceChains).flatMap(chain=>{
      try{const value=JSON.parse(localStorage.getItem(`hoj-market-cart:${chain.id}`)??"[]") as unknown;
        const ids=Array.isArray(value)?value.filter((id):id is string=>typeof id==="string"):[];
        return ids.length?[{chainId:chain.id as MarketplaceChainId,name:chain.name,currency:chain.currency,ids,listings:[],loading:true,error:""}]:[];
      }catch{return [];}
    });
    queueMicrotask(()=>{if(active)setGroups(initial);});
    for(const group of initial){void fetch(`/api/indexer?chainId=${group.chainId}&view=listings`).then(async response=>{
      if(!response.ok)throw new Error("Listings are temporarily unavailable.");
      const body=await response.json() as {listings:Listing[];stale?:boolean};
      if(body.stale)throw new Error("Live verification is unavailable; checkout is paused.");
      if(active)setGroups(current=>current.map(item=>item.chainId===group.chainId?{...item,listings:body.listings.filter(listing=>item.ids.includes(listing.id)),loading:false}:item));
    }).catch(()=>{if(active)setGroups(current=>current.map(item=>item.chainId===group.chainId?{...item,loading:false,error:"Listings are temporarily unavailable. Retry by reloading this page."}:item));});}
    return()=>{active=false;};
  },[]);
  function remove(chainId:MarketplaceChainId,id:string){
    setGroups(current=>current.map(group=>{
      if(group.chainId!==chainId)return group;
      const ids=group.ids.filter(value=>value!==id);
      localStorage.setItem(`hoj-market-cart:${chainId}`,JSON.stringify(ids));
      window.dispatchEvent(new Event("hoj-cart-updated"));
      return {...group,ids,listings:group.listings.filter(item=>item.id!==id)};
    }).filter(group=>group.ids.length));
  }
  const count=groups.reduce((sum,group)=>sum+group.ids.length,0);
  const visibleGroups=groups.map(group=>({...group,visibleIds:group.ids.filter(id=>{
    const listing=group.listings.find(item=>item.id===id);
    return matchesNftQuery(query,[group.name,listing?.nftAddress,listing?.tokenId,id]);
  })})).filter(group=>group.visibleIds.length);
  return <main className="hoj-cart-page"><header><span>MARKETPLACE CART</span><h1>Your cart</h1><p>{count} {count===1?"NFT":"NFTs"} saved for checkout. Purchases settle separately on each network.</p></header>
    {groups.length>0&&<label className="nft-inline-search"><Search size={17} aria-hidden="true"/><input type="search" value={query} onChange={event=>setQuery(event.target.value)} aria-label="Search NFTs in cart" placeholder="Search NFTs in cart"/></label>}
    {groups.length===0?<section className="hoj-cart-empty"><ShoppingCart size={28}/><h2>Your cart is empty</h2><p>Find an NFT you love and add it here.</p><Link href="/market">Explore listed NFTs</Link></section>:visibleGroups.length===0?<section className="hoj-cart-empty"><Search size={28}/><h2>No matching NFTs</h2><p>Try a different network, contract or token ID.</p></section>:visibleGroups.map(group=><section className="hoj-cart-group" key={group.chainId}><div className="hoj-cart-group-heading"><h2>{group.name}</h2><strong>{group.listings.length?<>{formatEther(group.listings.reduce((sum,item)=>sum+BigInt(item.price),0n))} {group.currency}<UsdEstimate wei={group.listings.reduce((sum,item)=>sum+BigInt(item.price),0n)} currency={group.currency}/></>:""}</strong></div>
      {group.loading?<p>Checking current listings…</p>:group.error?<p>{group.error}</p>:group.visibleIds.map(id=>{const item=group.listings.find(listing=>listing.id===id);return <article key={id} className="hoj-cart-row"><div className="hoj-cart-row-art">{item?<Image src={`/api/nft-image?${new URLSearchParams({chainId:String(group.chainId),contract:item.nftAddress,tokenId:item.tokenId})}`} alt="" width={56} height={56} unoptimized/>:<ShoppingCart size={20}/>}</div><div><strong>{item?`Token #${item.tokenId}`:"Listing unavailable"}</strong><small>{item?item.nftAddress:"This item is no longer in the active listings."}</small></div><span>{item?<>{formatEther(BigInt(item.price))} {group.currency}<UsdEstimate wei={item.price} currency={group.currency}/></>:"—"}</span><button onClick={()=>remove(group.chainId,id)} aria-label="Remove from cart"><Trash2 size={17}/></button></article>;})}
      <Link className="hoj-cart-checkout" href={`/market?chainId=${group.chainId}&cart=1`}>Review and checkout on {group.name}</Link>
    </section>)}
  </main>;
}
