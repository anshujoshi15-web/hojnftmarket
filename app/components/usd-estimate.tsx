"use client";

import { useSyncExternalStore } from "react";
import { formatEther } from "viem";

type Rates=Record<string,number>;
let cached:Rates|null=null;
let cachedAt=0;
let pending:Promise<Rates>|null=null;
let timer:ReturnType<typeof setInterval>|null=null;
const listeners=new Set<()=>void>();

function publish(){for(const listener of listeners)listener();}

async function loadRates(){
  if(cached&&Date.now()-cachedAt<300_000)return cached;
  if(!pending)pending=fetch("/api/usd-rates").then(async response=>{
    if(!response.ok)throw new Error("USD rates unavailable");
    const body=await response.json() as {rates:Rates};
    cached=body.rates;
    cachedAt=Date.now();
    publish();
    return cached;
  }).catch(error=>{cached=null;publish();throw error;}).finally(()=>{pending=null;});
  return pending;
}

function subscribe(listener:()=>void){
  listeners.add(listener);
  if(!timer){
    void loadRates().catch(()=>{});
    timer=setInterval(()=>{void loadRates().catch(()=>{});},300_000);
  }
  return ()=>{
    listeners.delete(listener);
    if(listeners.size===0&&timer){clearInterval(timer);timer=null;}
  };
}

const snapshot=()=>cached;
const serverSnapshot=()=>null;

export function UsdEstimate({wei,currency}:{wei:bigint|string;currency:string}){
  const rates=useSyncExternalStore(subscribe,snapshot,serverSnapshot);
  const rate=rates?.[currency];
  if(!rate)return null;
  let usd:number;
  try{usd=Number(formatEther(BigInt(wei)))*rate;}catch{return null;}
  if(!Number.isFinite(usd)||usd<0)return null;
  const formatted=usd>0&&usd<0.01?"<$0.01":new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:2}).format(usd);
  return <span className="usd-estimate" title="Approximate USD value at the latest available market rate">≈ {formatted} USD</span>;
}
