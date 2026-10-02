"use client";

import { useState } from "react";
import Image from "next/image";
import { erc1155Abi, formatEther, isAddress, maxUint256, type Address } from "viem";
import { useAccount, usePublicClient } from "wagmi";
import { marketplaceAbi, parseNativeAmount } from "@/lib/marketplace-abi";
import { getMarketplaceChain, transactionUrl, type MarketplaceChainId } from "@/lib/marketplace-chains";
import { TransactionStatus, useMarketplaceTransaction } from "./use-marketplace-transaction";

type EditionItem = { contractAddress: string; tokenId: string; name: string | null; imageUrl: string | null; quantity?: string };
type Props = { chainId: MarketplaceChainId; collection: string; items: EditionItem[]; onRemove: (tokenId: string) => void; onClear: () => void };
const quantityOf = (value: string) => /^[1-9]\d{0,77}$/.test(value) && BigInt(value) <= maxUint256 ? BigInt(value) : 0n;

export function ProfileEditionListingFlow({ chainId, collection, items, onRemove, onClear }: Props) {
  const chain = getMarketplaceChain(chainId);
  const market = chain.marketplaceAddress as Address;
  const { address } = useAccount();
  const client = usePublicClient({ chainId });
  const transaction = useMarketplaceTransaction(chainId);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"prices" | "review" | "done">("prices");
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [allPrice, setAllPrice] = useState("");
  const [error, setError] = useState("");
  const [listedHashes, setListedHashes] = useState<string[]>([]);
  const total = (() => {
    try {
      let sum = 0n;
      for (const item of items) {
        const units = quantityOf(quantities[item.tokenId] ?? "1");
        if (!units || units > BigInt(item.quantity ?? "0")) return null;
        sum += units * parseNativeAmount(prices[item.tokenId] ?? "");
        if (sum > maxUint256) return null;
      }
      return sum;
    } catch { return null; }
  })();

  async function submit() {
    if (!address || !client || !isAddress(collection) || !total) { setError("Connect your wallet and enter valid quantities and prices."); return; }
    setError("");
    const confirmed: Array<{ tokenId: string; hash: string }> = [];
    const success = await transaction.run("Edition listings", async send => {
      const version = await client.readContract({ address: market, abi: marketplaceAbi, functionName: "marketplaceVersion" });
      if (version < 4n) throw new Error("Edition listings are not supported on this marketplace.");
      if (new Set(items.map(item => item.tokenId)).size !== items.length || items.some(item => item.contractAddress.toLowerCase() !== collection.toLowerCase())) throw new Error("Select unique editions from one collection.");
      for (const item of items) {
        const units = quantityOf(quantities[item.tokenId] ?? "1");
        const held = await client.readContract({ address: collection as Address, abi: erc1155Abi, functionName: "balanceOf", args: [address, BigInt(item.tokenId)] });
        if (!units || units > held) throw new Error(`You do not own enough editions of token #${item.tokenId}. Refresh Profile.`);
      }
      const approved = await client.readContract({ address: collection as Address, abi: erc1155Abi, functionName: "isApprovedForAll", args: [address, market] });
      if (!approved) {
        await send({ address: collection as Address, abi: erc1155Abi, functionName: "setApprovalForAll", args: [market, true] }, "One-time collection approval");
        const nowApproved = await client.readContract({ address: collection as Address, abi: erc1155Abi, functionName: "isApprovedForAll", args: [address, market] });
        if (!nowApproved) throw new Error("Collection approval was not confirmed. Please try again.");
      }
      for (const item of items) {
        const receipt = await send({ address: market, abi: marketplaceAbi, functionName: "listEdition", args: [collection as Address, BigInt(item.tokenId), quantityOf(quantities[item.tokenId] ?? "1"), parseNativeAmount(prices[item.tokenId])] }, `List edition #${item.tokenId}`);
        confirmed.push({ tokenId: item.tokenId, hash: receipt.transactionHash });
        setListedHashes(current => [...current, receipt.transactionHash]);
      }
    });
    if (success) setStep("done");
    else if (confirmed.length) {
      confirmed.forEach(item => onRemove(item.tokenId));
      setError(`${confirmed.length} edition listing${confirmed.length === 1 ? " was" : "s were"} confirmed. Review the remaining selection before trying again.`);
      setStep("prices");
    }
  }

  if (!items.length) return null;
  return <>
    <div className="profile-listing-bar" role="region" aria-label="Selected editions for listing">
      <div className="profile-listing-bar-items">{items.slice(0, 4).map(item => item.imageUrl ? <Image key={item.tokenId} src={item.imageUrl} alt="" width={48} height={48} unoptimized/> : <span key={item.tokenId}>#{item.tokenId}</span>)}{items.length > 4 && <span>+{items.length - 4}</span>}</div>
      <strong>{items.length} editions selected <small>· {chain.name} · one collection</small></strong>
      <button type="button" className="profile-listing-clear" onClick={onClear}>Clear</button>
      <button type="button" className="profile-listing-primary" onClick={() => { setOpen(true); setStep("prices"); setError(""); setListedHashes([]); }}>List editions</button>
    </div>
    {open && <div className="profile-listing-overlay" onMouseDown={event => { if (event.target === event.currentTarget && !transaction.pending) setOpen(false); }}><section className="profile-listing-dialog" role="dialog" aria-modal="true" aria-labelledby="edition-bulk-title">
      <header><div><small>{chain.name} · {items.length} edition{items.length === 1 ? "" : "s"}</small><h2 id="edition-bulk-title">{step === "prices" ? "Set edition listings" : step === "review" ? "Review edition listings" : "Editions listed"}</h2></div><button type="button" disabled={transaction.pending} onClick={() => setOpen(false)} aria-label="Close listing dialog">×</button></header>
      {step === "prices" && <><p>Choose how many copies to list and a price per copy for each edition.</p><div className="profile-listing-set-all"><label htmlFor="edition-listing-all">Price per edition</label><div><input id="edition-listing-all" inputMode="decimal" value={allPrice} onChange={event => setAllPrice(event.target.value)} placeholder="0.00"/><span>{chain.currency}</span><button type="button" onClick={() => setPrices(Object.fromEntries(items.map(item => [item.tokenId, allPrice])))}>Apply</button></div></div><div className="profile-listing-rows">{items.map(item => <div className="profile-listing-row profile-edition-row" key={item.tokenId}>{item.imageUrl ? <Image src={item.imageUrl} alt="" width={48} height={48} unoptimized/> : <span className="profile-listing-fallback">#{item.tokenId}</span>}<div className="profile-listing-item-name"><strong>{item.name || `Token #${item.tokenId}`}</strong><small>#{item.tokenId} · {item.quantity ?? "0"} owned</small></div><label className="profile-edition-field"><span>Quantity</span><input aria-label={`Quantity of ${item.name || `token #${item.tokenId}`}`} inputMode="numeric" value={quantities[item.tokenId] ?? "1"} onChange={event => setQuantities(current => ({ ...current, [item.tokenId]: event.target.value }))}/></label><label className="profile-edition-field"><span>Price per edition</span><input aria-label={`Price per edition for ${item.name || `token #${item.tokenId}`}`} inputMode="decimal" placeholder="0.00" value={prices[item.tokenId] ?? ""} onChange={event => setPrices(current => ({ ...current, [item.tokenId]: event.target.value }))}/><em>{chain.currency}</em></label><button type="button" aria-label={`Remove ${item.name || `token #${item.tokenId}`}`} onClick={() => onRemove(item.tokenId)}>×</button></div>)}</div><div className="profile-listing-summary"><span>Total if all copies sell</span><strong>{total ? formatEther(total) : "—"} {chain.currency}</strong></div>{error && <p className="profile-listing-error" role="alert">{error}</p>}<footer><button type="button" className="profile-listing-primary" onClick={() => { setError(""); setStep("review"); }} disabled={!total}>Review listings</button></footer></>}
      {step === "review" && <><p>One collection approval may be needed. Your wallet will then ask for one transaction per selected edition. Confirmed listings stay active if a later transaction fails.</p><div className="profile-listing-rows">{items.map(item => <div className="profile-listing-row" key={item.tokenId}><div className="profile-listing-item-name"><strong>{item.name || `Token #${item.tokenId}`}</strong><small>#{item.tokenId}</small></div><strong>{quantities[item.tokenId] ?? "1"} × {prices[item.tokenId]} {chain.currency}</strong></div>)}</div><div className="profile-listing-summary"><span>Total if all copies sell</span><strong>{formatEther(total ?? 0n)} {chain.currency}</strong><span>Marketplace fee on sale (2%)</span><strong>{formatEther((total ?? 0n) * 2n / 100n)} {chain.currency}</strong></div><TransactionStatus transaction={transaction}/>{error && <p className="profile-listing-error" role="alert">{error}</p>}<footer><button type="button" disabled={transaction.pending} onClick={() => setStep("prices")}>Back to prices</button><button type="button" className="profile-listing-primary" disabled={transaction.pending} onClick={() => void submit()}>{transaction.pending ? "Confirming…" : "Confirm and list"}</button></footer></>}
      {step === "done" && <><p>All {listedHashes.length} edition listing{listedHashes.length === 1 ? " was" : "s were"} confirmed.</p>{listedHashes.map((hash, index) => <p key={hash}><a href={transactionUrl(chainId, hash)} target="_blank" rel="noreferrer">View listing {index + 1} ↗</a></p>)}<footer><button type="button" className="profile-listing-primary" onClick={() => { setOpen(false); onClear(); }}>Done</button></footer></>}
    </section></div>}
  </>;
}
