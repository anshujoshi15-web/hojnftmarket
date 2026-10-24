"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { zeroAddress } from "viem";
import { astralsAddress, astralsMintQuote, readAstralsMint, seaDropAbi, seaDropAddress } from "@/lib/astrals-mint";
import { useMarketplaceTransaction } from "@/app/components/use-marketplace-transaction";

export default function AstralsMint() {
  const {address}=useAccount();
  const transaction=useMarketplaceTransaction(5042);
  const [quantity,setQuantity]=useState(1);
  const [data,setData]=useState<Awaited<ReturnType<typeof readAstralsMint>>>();
  const [status,setStatus]=useState("Checking live Arc mint availability…");
  const [checking,setChecking]=useState(true);
  const revision=useRef(0);
  const refresh=useCallback(async()=>{
    const version=++revision.current;
    setChecking(true);setData(undefined);
    try {
      const next=await readAstralsMint(address);
      if(version!==revision.current)return;
      setData(next);setStatus("");
    } catch { if(version===revision.current)setStatus("Mint availability could not be verified. Refresh to retry or visit the official mint site."); }
    finally {if(version===revision.current)setChecking(false);}
  },[address]);
  const invalidate=useCallback(()=>{revision.current++;},[]);
  useEffect(()=>{const initial=setTimeout(()=>void refresh(),0);const timer=setInterval(()=>void refresh(),30000);return()=>{invalidate();clearTimeout(initial);clearInterval(timer);};},[refresh,invalidate]);
  let issue=status;
  if(data)try{astralsMintQuote(data,quantity);}catch(error){issue=(error as Error).message;}
  async function mint(){
    const success=await transaction.run("Joshi Astrals mint",async send=>{
      const fresh=await readAstralsMint(address);
      const quote=astralsMintQuote(fresh,quantity);
      await send({address:seaDropAddress,abi:seaDropAbi,functionName:"mintPublic",args:[astralsAddress,quote.feeRecipient,zeroAddress,BigInt(quantity)],value:quote.value});
    });
    if(success)await refresh();
  }
  return <div className="astrals-mint">
    <h3>Mint Joshi Astrals</h3>
    <p>25 USDC each + Arc network gas · Planned limit: two public mints per wallet. No buyer whitelist.</p>
    <p>Planned public mint: 25 October 2026. Final availability is controlled by the official OpenSea Drop; live availability appears below.</p>
    {data&&<p>{data.stats[1].toString()} / {data.stats[2].toString()} minted</p>}
    <label>Quantity <select value={quantity} disabled={transaction.pending||transaction.uncertain} onChange={event=>setQuantity(Number(event.target.value))}><option value={1}>1 Astral — 25 USDC</option><option value={2}>2 Astrals — 50 USDC</option></select></label>
    <div className="astrals-drop-links">
      {address?<button type="button" className="royal-view-all" disabled={checking||!!issue||!data||transaction.pending||transaction.uncertain} onClick={()=>void mint()}>{transaction.pending?"Mint in progress…":`Mint ${quantity} ${quantity===1?"Astral":"Astrals"}`}</button>:<ConnectButton.Custom>{({openConnectModal})=><button type="button" className="royal-view-all" onClick={openConnectModal}>Connect wallet to mint</button>}</ConnectButton.Custom>}
      <button type="button" className="royal-view-all" disabled={checking||transaction.pending} onClick={()=>void refresh()}>Refresh availability</button>
      {transaction.uncertain&&<button type="button" onClick={()=>void transaction.check()}>Check transaction</button>}
    </div>
    <p role="status">{transaction.message||issue||(checking?"Checking live availability…":"Public mint is open. Review the transaction in your wallet.")}</p>
    {transaction.hash&&<a href={`https://explorer.arc.io/tx/${transaction.hash}`} target="_blank" rel="noopener noreferrer">View mint transaction ↗</a>}
  </div>;
}
