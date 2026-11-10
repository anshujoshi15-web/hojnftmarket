"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { getMarketplaceChain, isMarketplaceChainId, type MarketplaceChainId } from "@/lib/marketplace-chains";

const prefix="hoj:followed-collection:";
const changed="hoj:collection-follow-changed";
type Follow={chainId:MarketplaceChainId;contract:string;name?:string};
const keyFor=(chainId:number,contract:string)=>prefix+chainId+":"+contract.toLowerCase();
function subscribe(listener:()=>void){
  window.addEventListener("storage",listener);
  window.addEventListener(changed,listener);
  return()=>{window.removeEventListener("storage",listener);window.removeEventListener(changed,listener);};
}
function snapshot(){
  try{
    const items:Follow[]=[];
    for(const key of Object.keys(localStorage)){
      const match=key.match(/^hoj:followed-collection:(\d+):(0x[a-f0-9]{40})$/i);
      if(!match)continue;
      const chainId=Number(match[1]),value=localStorage.getItem(key);
      if(!value||value==="0"||!isMarketplaceChainId(chainId))continue;
      items.push({chainId,contract:match[2],name:value==="1"?undefined:value});
    }
    return JSON.stringify(items.sort((a,b)=>keyFor(a.chainId,a.contract).localeCompare(keyFor(b.chainId,b.contract))));
  }catch{return "[]";}
}
function useFollows(){
  return JSON.parse(useSyncExternalStore(subscribe,snapshot,()=>"[]")) as Follow[];
}
export function FollowCollection({chainId,contract,name}:Follow){
  const following=useFollows().some(item=>keyFor(item.chainId,item.contract)===keyFor(chainId,contract));
  return <button type="button" className="royal-view-all" aria-pressed={following} onClick={()=>{
    try{
      const key=keyFor(chainId,contract);
      if(following)localStorage.removeItem(key);
      else localStorage.setItem(key,name||"1");
      window.dispatchEvent(new Event(changed));
    }catch{/* This browser may block local storage. */}
  }}>{following?"Following":"Follow collection"}</button>;
}
export function FollowedCollections(){
  const items=useFollows();
  return <section className="hoj-followed-collections" aria-labelledby="followed-collections-title">
    <h2 id="followed-collections-title">Followed collections</h2>
    <p>Saved on this browser.</p>
    {items.length?<ul>{items.map(item=><li key={keyFor(item.chainId,item.contract)}>
      <Link href={`/collection/${item.chainId}/${item.contract}`}>{item.name||`${item.contract.slice(0,6)}…${item.contract.slice(-4)}`} · {getMarketplaceChain(item.chainId).name}</Link>
      <FollowCollection {...item}/>
    </li>)}</ul>:<p>Follow a collection from Discover or its collection page to find it here.</p>}
  </section>;
}
