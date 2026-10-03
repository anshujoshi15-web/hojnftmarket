"use client";

import { Heart, ImageIcon, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getMarketplaceChain, isMarketplaceChainId, type MarketplaceChainId } from "@/lib/marketplace-chains";
import { matchesNftQuery } from "@/lib/nft-search";
import { NftCardVideo } from "../components/nft-card-video";

type FavoriteItem = { id:string; chainId:MarketplaceChainId; contract:string; tokenId:string; name:string|null; collection:string|null; imageUrl:string|null; videoUrl:string|null };
const STORAGE_KEY = "hoj-marketplace-favorites";

function parseFavorite(id:string){
  const [rawChainId,contract,...tokenParts]=id.split(":");
  const chainId=Number(rawChainId); const tokenId=tokenParts.join(":");
  if(!isMarketplaceChainId(chainId)||!/^0x[a-fA-F0-9]{40}$/.test(contract)||!/^\d+$/.test(tokenId))return null;
  return {id,chainId,contract,tokenId};
}

export default function FavoritesPage(){
  const[items,setItems]=useState<FavoriteItem[]>([]); const[loading,setLoading]=useState(true);
  const[query,setQuery]=useState("");
  useEffect(()=>{let active=true;void(async()=>{
    let ids:string[]=[];try{ids=JSON.parse(localStorage.getItem(STORAGE_KEY)??"[]") as string[];}catch{}
    const favorites=ids.map(parseFavorite).filter(Boolean) as Array<NonNullable<ReturnType<typeof parseFavorite>>>;
    const loaded=await Promise.all(favorites.map(async favorite=>{try{
      const query=new URLSearchParams({chainId:String(favorite.chainId),contract:favorite.contract,tokenId:favorite.tokenId});
      const response=await fetch(`/api/nft?${query}`);
      const metadata=response.ok?await response.json() as Pick<FavoriteItem,"name"|"collection"|"imageUrl"|"videoUrl">:null;
      return {...favorite,name:metadata?.name??null,collection:metadata?.collection??null,imageUrl:metadata?.imageUrl??null,videoUrl:metadata?.videoUrl??null};
    }catch{return {...favorite,name:null,collection:null,imageUrl:null,videoUrl:null};}}));
    if(active){setItems(loaded);setLoading(false);}
  })();return()=>{active=false;};},[]);
  function remove(id:string){setItems(current=>{const next=current.filter(item=>item.id!==id);localStorage.setItem(STORAGE_KEY,JSON.stringify(next.map(item=>item.id)));return next;});}
  const matching=items.filter(item=>matchesNftQuery(query,[item.name,item.collection,item.contract,item.tokenId,getMarketplaceChain(item.chainId).name]));
  return <main className="royal-page"><section className="royal-page-hero"><div className="royal-badge"><Heart size={16}/><span>Favorites</span></div><h1>Saved NFTs</h1><p>Your watchlist of NFTs across every supported network.</p></section><section className="royal-content">
    {items.length>0&&<label className="nft-inline-search"><Search size={17} aria-hidden="true"/><input type="search" value={query} onChange={event=>setQuery(event.target.value)} aria-label="Search saved NFTs" placeholder="Search saved NFTs"/></label>}
    {loading?<div className="royal-loading-grid">{[...Array(4)].map((_,i)=><div key={i} className="royal-skeleton-card"/>)}</div>:matching.length?<div className="royal-portfolio-grid">{matching.map(item=>{const chain=getMarketplaceChain(item.chainId);return <article key={item.id} className="royal-profile-nft"><Link href={`/nft/${item.chainId}/${item.contract}/${item.tokenId}`}><div className="royal-nft-image" style={!item.videoUrl&&item.imageUrl?{backgroundImage:`url(${item.imageUrl})`}:undefined}>{item.videoUrl?<NftCardVideo src={item.videoUrl} poster={item.imageUrl} label={item.name??`Token #${item.tokenId}`}/>:!item.imageUrl&&<ImageIcon size={32}/>}</div><div className="royal-nft-details"><small>{item.collection??chain.name}</small><h3>{item.name??`Token #${item.tokenId}`}</h3><span>{chain.name}</span></div></Link><button className="royal-favorite-remove" onClick={()=>remove(item.id)} aria-label={`Remove ${item.name??`token ${item.tokenId}`} from favorites`}><Trash2 size={15}/> Remove</button></article>;})}</div>:<div className="royal-empty-state"><Heart size={48}/><h2>{items.length?"No matching NFTs":"No Favorites Yet"}</h2><p>{items.length?"Try a different name, network, contract or token ID.":"Save an NFT from its item page or marketplace card."}</p>{!items.length&&<Link className="royal-primary-button" href="/market">Explore NFTs</Link>}</div>}
  </section></main>;
}
