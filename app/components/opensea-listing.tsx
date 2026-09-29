"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { ArrowUpRight } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { formatUnits } from "viem";
import { useAccount } from "wagmi";
import { basicOrderAbi, openSeaChains, parseBasicOrder, type OpenSeaListing } from "@/lib/opensea";
import { isMarketplaceLive, type MarketplaceChainId } from "@/lib/marketplace-chains";
import { TransactionStatus, useMarketplaceTransaction } from "./use-marketplace-transaction";
import { notifyNFTPurchased } from "@/lib/notifications";

export function OpenSeaListingPanel({chainId,contract,tokenId}:{chainId:MarketplaceChainId;contract:string;tokenId:string}){
  const [listing,setListing]=useState<OpenSeaListing|null>(null);
  const [message,setMessage]=useState("");
  const [loading,setLoading]=useState(false);
  const {address}=useAccount();
  const transaction=useMarketplaceTransaction(chainId);
  const refresh=useCallback(async()=>{
    if(!openSeaChains[chainId])return;
    try{
      const params=new URLSearchParams({chainId:String(chainId),contract,tokenId});
      const response=await fetch(`/api/opensea/listing?${params}`,{cache:"no-store"});
      if(!response.ok)throw new Error("OpenSea listings are unavailable right now.");
      const body=await response.json() as {listing:OpenSeaListing|null};
      setListing(body.listing);
      setMessage("");
    }catch{setMessage("OpenSea listings could not be checked right now.");}
  },[chainId,contract,tokenId]);
  useEffect(()=>{
    if(!openSeaChains[chainId])return;
    queueMicrotask(()=>{void refresh();});
    const timer=window.setInterval(()=>{if(!document.hidden)void refresh();},30_000);
    const onFocus=()=>{if(!document.hidden)void refresh();};
    window.addEventListener("focus",onFocus);
    return()=>{window.clearInterval(timer);window.removeEventListener("focus",onFocus);};
  },[chainId,refresh]);
  if(!openSeaChains[chainId]||!listing&&!message)return null;
  const isSeller=!!address&&listing?.seller.toLowerCase()===address.toLowerCase();
  async function buy(){
    if(!address||!listing||loading)return;
    setLoading(true);setMessage("");
    try{
      const response=await fetch("/api/opensea/listing",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({chainId,contract,tokenId,fulfiller:address,orderHash:listing.orderHash,protocolAddress:listing.protocolAddress})});
      const body=await response.json() as {to?:`0x${string}`;value?:string;parameters?:unknown;error?:string};
      if(!response.ok)throw new Error(body.error??"OpenSea checkout is unavailable.");
      const parameters=parseBasicOrder(body.parameters);
      if(!body.to||!body.value||!parameters)throw new Error("OpenSea checkout data was incomplete.");
      const ok=await transaction.run("OpenSea purchase",async send=>{
        const receipt=await send({address:body.to!,abi:basicOrderAbi,functionName:"fulfillBasicOrder_efficient_6GL6yc",args:[parameters],value:BigInt(body.value!)});
        notifyNFTPurchased(address,`Token #${tokenId}`,formatUnits(BigInt(listing.price),listing.decimals),listing.currency,chainId,receipt.transactionHash,contract,tokenId);
      });
      if(ok)void refresh();
    }catch(error){setMessage(error instanceof Error?error.message:"OpenSea checkout is unavailable.");void refresh();}
    finally{setLoading(false);}
  }
  return <section className="royal-nft-panel opensea-listing-panel" aria-label="OpenSea listing">
    <header><span>Also listed on OpenSea</span></header>
    {listing?<>
      <p>This is an OpenSea order. It uses OpenSea’s Seaport contract and may sell on either marketplace.</p>
      <strong>{formatUnits(BigInt(listing.price),listing.decimals)} {listing.currency}</strong>
      <div className="opensea-listing-actions">
        {!isSeller&&isMarketplaceLive(chainId)&&(address?<button type="button" disabled={loading||transaction.pending} onClick={()=>void buy()}>{loading?"Checking listing…":"Buy OpenSea listing"}</button>:<ConnectButton.Custom>{({openConnectModal})=><button type="button" onClick={openConnectModal}>Connect to buy</button>}</ConnectButton.Custom>)}
        <a href={listing.url} target="_blank" rel="noreferrer">View on OpenSea <ArrowUpRight size={14}/></a>
      </div>
      <TransactionStatus transaction={transaction}/>
    </>:null}
    {message&&<p role="status">{message}</p>}
  </section>;
}
