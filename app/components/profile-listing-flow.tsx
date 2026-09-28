"use client";

import { useEffect, useMemo, useState } from "react";
import { erc721Abi, formatEther, isAddress, type Address } from "viem";
import { useAccount, usePublicClient } from "wagmi";
import { marketplaceAbi, parseNativeAmount } from "@/lib/marketplace-abi";
import { marketplaceChains, transactionUrl, type MarketplaceChainId } from "@/lib/marketplace-chains";
import { useMarketplaceTransaction, TransactionStatus } from "./use-marketplace-transaction";

type Item={contractAddress:string;tokenId:string;name:string|null;imageUrl:string|null};
type Props={chainId:MarketplaceChainId;collection:string;items:Item[];onRemove:(tokenId:string)=>void;onClear:()=>void};
const oldMarkets:Partial<Record<MarketplaceChainId,Address>>={
  25:"0x74cE4e02E754DAdc3BA27CB4f8678538F0833eab",
  109:"0x455DaD76334a67660D61bb319d8CfF1010e33049",
  5042:"0xD9883fDdf57Ca58f775Bdab96C0e7c3F1c918af3",
  8453:"0x50489Fdc2352917595359667b34b384b33184b91",
};

export function ProfileListingFlow({chainId,collection,items,onRemove,onClear}:Props){
  const chain=marketplaceChains[chainId];
  const market=chain.marketplaceAddress as Address;
  const {address}=useAccount();
  const client=usePublicClient({chainId});
  const transaction=useMarketplaceTransaction(chainId);
  const [open,setOpen]=useState(false);
  const [step,setStep]=useState<"prices"|"review"|"done">("prices");
  const [prices,setPrices]=useState<Record<string,string>>({});
  const [allPrice,setAllPrice]=useState("");
  const [error,setError]=useState("");
  const [approvalNeeded,setApprovalNeeded]=useState<boolean|null>(null);
  const [listedHash,setListedHash]=useState<string>();
  const total=useMemo(()=>{
    try{return items.reduce((sum,item)=>sum+parseNativeAmount(prices[item.tokenId]??""),0n);}catch{return null;}
  },[items,prices]);
  useEffect(()=>{
    if(!open)return;
    const onKey=(event:KeyboardEvent)=>{if(event.key==="Escape"&&!transaction.pending)setOpen(false);};
    document.addEventListener("keydown",onKey);
    return()=>document.removeEventListener("keydown",onKey);
  },[open,transaction.pending]);
  if(!items.length)return null;
  function review(){
    if(!total||total<=0n){setError("Enter a positive price for every selected NFT, up to 18 decimal places.");return;}
    setError("");setStep("review");
    if(client&&address)void client.readContract({address:collection as Address,abi:erc721Abi,functionName:"isApprovedForAll",args:[address,market]}).then(value=>setApprovalNeeded(!value)).catch(()=>setApprovalNeeded(null));
  }
  async function submit(){
    if(!address||!client||!isAddress(collection)||!total){setError("Connect your wallet and enter valid prices before listing.");return;}
    const tokenIds=items.map(item=>BigInt(item.tokenId));
    const amounts=items.map(item=>parseNativeAmount(prices[item.tokenId]));
    setError("");
    const success=await transaction.run("Listing",async send=>{
      const version=await client.readContract({address:market,abi:marketplaceAbi,functionName:"marketplaceVersion"});
      if(version<8n)throw new Error("This network is not connected to a V8 marketplace contract.");
      if(new Set(items.map(item=>item.tokenId)).size!==items.length||items.some(item=>item.contractAddress.toLowerCase()!==collection.toLowerCase()))throw new Error("Select unique NFTs from one collection.");
      for(const tokenId of tokenIds){
        const owner=await client.readContract({address:collection as Address,abi:erc721Abi,functionName:"ownerOf",args:[tokenId]});
        if(owner.toLowerCase()!==address.toLowerCase())throw new Error(`You no longer own token #${tokenId}. Refresh Profile.`);
        const current=await client.readContract({address:market,abi:marketplaceAbi,functionName:"getListing",args:[collection as Address,tokenId]});
        if(current.price>0n&&current.seller.toLowerCase()===address.toLowerCase())throw new Error(`Token #${tokenId} is already listed here. Cancel that listing first.`);
        const old=oldMarkets[chainId];
        if(old){
          const previous=await client.readContract({address:old,abi:marketplaceAbi,functionName:"getListing",args:[collection as Address,tokenId]});
          if(previous&&previous.price>0n&&previous.seller.toLowerCase()===address.toLowerCase())throw new Error(`Token #${tokenId} is listed on the earlier marketplace. Cancel it there first.`);
        }
      }
      const approved=await client.readContract({address:collection as Address,abi:erc721Abi,functionName:"isApprovedForAll",args:[address,market]});
      if(!approved){
        await send({address:collection as Address,abi:erc721Abi,functionName:"setApprovalForAll",args:[market,true]},"One-time collection approval");
        const nowApproved=await client.readContract({address:collection as Address,abi:erc721Abi,functionName:"isApprovedForAll",args:[address,market]});
        if(!nowApproved)throw new Error("Collection approval was not confirmed. Please try again.");
      }
      const receipt=await send({address:market,abi:marketplaceAbi,functionName:items.length===1?"listItem":"batchList",args:items.length===1?[collection as Address,tokenIds[0],amounts[0]]:[collection as Address,tokenIds,amounts]},items.length===1?"List NFT":"List selected NFTs");
      setListedHash(receipt.transactionHash);
    });
    if(success)setStep("done");
  }
  return <>
    <div className="profile-listing-bar" role="region" aria-label="Selected NFTs for listing">
      <div className="profile-listing-bar-items">{items.slice(0,4).map(item=>item.imageUrl?<img key={item.tokenId} src={item.imageUrl} alt=""/>:<span key={item.tokenId}>#{item.tokenId}</span>)}{items.length>4&&<span>+{items.length-4}</span>}</div>
      <strong>{items.length} selected <small>· {chain.name} · one collection</small></strong>
      <button type="button" className="profile-listing-clear" onClick={onClear}>Clear</button>
      <button type="button" className="profile-listing-primary" onClick={()=>{setOpen(true);setStep("prices");setError("");}}>List {items.length} NFT{items.length===1?"":"s"}</button>
    </div>
    {open&&<div className="profile-listing-overlay" onMouseDown={event=>{if(event.target===event.currentTarget&&!transaction.pending)setOpen(false);}}><section className="profile-listing-dialog" role="dialog" aria-modal="true" aria-labelledby="profile-listing-title">
      <header><div><small>{chain.name} · {items.length} NFT{items.length===1?"":"s"}</small><h2 id="profile-listing-title">{step==="prices"?"Create listings":step==="review"?"Review listings":"Listings submitted"}</h2></div><button type="button" aria-label="Close listing dialog" disabled={transaction.pending} onClick={()=>setOpen(false)}>×</button></header>
      {step==="prices"&&<><p>Set a price for each NFT. All selected NFTs must belong to the same collection.</p><div className="profile-listing-set-all"><label htmlFor="profile-listing-all">Set all prices</label><div><input id="profile-listing-all" inputMode="decimal" value={allPrice} onChange={event=>setAllPrice(event.target.value)} placeholder="0.00"/><span>{chain.currency}</span><button type="button" onClick={()=>setPrices(Object.fromEntries(items.map(item=>[item.tokenId,allPrice])))}>Apply</button></div></div><div className="profile-listing-rows">{items.map(item=><div className="profile-listing-row" key={item.tokenId}>{item.imageUrl?<img src={item.imageUrl} alt=""/>:<span className="profile-listing-fallback">#{item.tokenId}</span>}<div className="profile-listing-item-name"><strong>{item.name||`Token #${item.tokenId}`}</strong><small>#{item.tokenId}</small></div><label><span>Price</span><input aria-label={`Price for ${item.name||`token #${item.tokenId}`}`} inputMode="decimal" placeholder="0.00" value={prices[item.tokenId]??""} onChange={event=>setPrices(current=>({...current,[item.tokenId]:event.target.value}))}/><em>{chain.currency}</em></label><button type="button" aria-label={`Remove ${item.name||`token #${item.tokenId}`}`} onClick={()=>onRemove(item.tokenId)}>×</button></div>)}</div><div className="profile-listing-summary"><span>Total listing price</span><strong>{total?formatEther(total):"—"} {chain.currency}</strong></div><footer><button type="button" className="profile-listing-primary" onClick={review} disabled={!total}>Review listings</button></footer></>}
      {step==="review"&&<><p>Check your prices and the wallet steps before confirming.</p><div className="profile-listing-rows">{items.map(item=><div className="profile-listing-row" key={item.tokenId}>{item.imageUrl?<img src={item.imageUrl} alt=""/>:<span className="profile-listing-fallback">#{item.tokenId}</span>}<div className="profile-listing-item-name"><strong>{item.name||`Token #${item.tokenId}`}</strong><small>#{item.tokenId}</small></div><strong>{prices[item.tokenId]} {chain.currency}</strong></div>)}</div><div className="profile-listing-summary"><span>Total listing price</span><strong>{formatEther(total??0n)} {chain.currency}</strong><span>Marketplace fee on sale (2%)</span><strong>{formatEther((total??0n)*2n/100n)} {chain.currency}</strong><span>Estimated proceeds before creator royalties</span><strong>{formatEther((total??0n)*98n/100n)} {chain.currency}</strong></div><p className="profile-listing-explain">Your NFTs stay in your wallet. {approvalNeeded===false?"Collection approval is already in place.":"If this collection is not yet approved for this marketplace, your wallet will ask for a separate one-time approval transaction."} Then {items.length===1?"the NFT is":"all selected NFTs are"} listed in one transaction. Wallet gas fees are separate. Listings have no expiry date.</p><TransactionStatus transaction={transaction}/>{error&&<p className="profile-listing-error" role="alert">{error}</p>}<footer><button type="button" disabled={transaction.pending} onClick={()=>setStep("prices")}>Back to prices</button><button type="button" className="profile-listing-primary" disabled={transaction.pending} onClick={()=>void submit()}>{transaction.pending?"Confirm in wallet…":"Confirm and list"}</button></footer></>}
      {step==="done"&&<><p>Your listing transaction was confirmed. The marketplace may take a moment to show the new listings.</p>{listedHash&&<a href={transactionUrl(chainId,listedHash)} target="_blank" rel="noreferrer">View transaction ↗</a>}<footer><button type="button" className="profile-listing-primary" onClick={()=>{setOpen(false);onClear();}}>Done</button></footer></>}
    </section></div>}
  </>;
}
