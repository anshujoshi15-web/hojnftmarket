import { env } from "@runtime-env";
import { isAddress, zeroAddress } from "viem";
import { isMarketplaceChainId, type MarketplaceChainId } from "@/lib/marketplace-chains";
import { openSeaChains, parseBasicOrder, parseOpenSeaListing, type OpenSeaListing } from "@/lib/opensea";
import type { RuntimeEnv } from "@/lib/server-marketplace-config";

export const dynamic="force-dynamic";
const base="https://api.opensea.io/api/v2";
type Item={chainId:MarketplaceChainId;contract:string;tokenId:string};

function itemFrom(value:Record<string,unknown>):Item|null {
  const chainId=Number(value.chainId),contract=value.contract,tokenId=value.tokenId;
  return isMarketplaceChainId(chainId)&&openSeaChains[chainId]&&typeof contract==="string"&&isAddress(contract,{strict:false})&&typeof tokenId==="string"&&/^\d+$/.test(tokenId)
    ?{chainId,contract,tokenId}:null;
}

async function openSeaFetch(path:string,key:string,init?:RequestInit){
  const response=await fetch(`${base}${path}`,{...init,headers:{accept:"application/json","x-api-key":key,...init?.headers},cache:"no-store",signal:AbortSignal.timeout(12_000)});
  if(response.status===404)return null;
  if(!response.ok)throw new Error(`OpenSea returned ${response.status}`);
  return response.json() as Promise<Record<string,unknown>>;
}

async function bestListing(item:Item,key:string):Promise<OpenSeaListing|null>{
  const chain=openSeaChains[item.chainId]!;
  const collection=await openSeaFetch(`/chain/${chain}/contract/${item.contract}/nfts/${item.tokenId}/collection`,key);
  const slug=collection?.collection;
  if(typeof slug!=="string"||!slug)return null;
  const raw=await openSeaFetch(`/listings/collection/${encodeURIComponent(slug)}/nfts/${item.tokenId}/best`,key);
  return raw?parseOpenSeaListing(raw,item.chainId,item.contract,item.tokenId):null;
}

const unavailable=()=>Response.json({error:"OpenSea listings are temporarily unavailable."},{status:503,headers:{"cache-control":"no-store"}});

export async function GET(request:Request){
  const params=new URL(request.url).searchParams;
  const item=itemFrom({chainId:params.get("chainId"),contract:params.get("contract"),tokenId:params.get("tokenId")});
  if(!item)return Response.json({error:"Unsupported NFT."},{status:400});
  const key=(env as unknown as RuntimeEnv).OPENSEA_API_KEY;
  if(!key)return Response.json({listing:null,configured:false},{headers:{"cache-control":"no-store"}});
  try{return Response.json({listing:await bestListing(item,key)},{headers:{"cache-control":"no-store"}});}
  catch{return unavailable();}
}

export async function POST(request:Request){
  let body:Record<string,unknown>;
  try{body=await request.json() as Record<string,unknown>;}catch{return Response.json({error:"Invalid request."},{status:400});}
  const item=itemFrom(body),fulfiller=body.fulfiller;
  if(!item||typeof fulfiller!=="string"||!isAddress(fulfiller,{strict:false})||typeof body.orderHash!=="string"||typeof body.protocolAddress!=="string")
    return Response.json({error:"Invalid purchase request."},{status:400});
  const key=(env as unknown as RuntimeEnv).OPENSEA_API_KEY;
  if(!key)return unavailable();
  try{
    // Re-read the order immediately before preparing checkout. Never trust the
    // order hash, contract address, or price supplied by the browser.
    const listing=await bestListing(item,key);
    if(!listing||listing.orderHash.toLowerCase()!==body.orderHash.toLowerCase()||listing.protocolAddress.toLowerCase()!==body.protocolAddress.toLowerCase())
      return Response.json({error:"This listing changed or sold. Refresh before buying."},{status:409});
    if(listing.seller.toLowerCase()===fulfiller.toLowerCase())return Response.json({error:"You own this listing."},{status:400});
    const chain=openSeaChains[item.chainId]!;
    const result=await openSeaFetch("/listings/fulfillment_data",key,{
      method:"POST",headers:{"content-type":"application/json"},
      body:JSON.stringify({listing:{hash:listing.orderHash,chain,protocol_address:listing.protocolAddress},fulfiller:{address:fulfiller},units_to_fill:1}),
    });
    const data=result?.fulfillment_data as {transaction?:Record<string,unknown>}|undefined;
    const tx=data?.transaction;
    const input=tx?.input_data as {parameters?:unknown}|undefined;
    const parameters=parseBasicOrder(input?.parameters);
    const value=typeof tx?.value==="string"&&/^\d+$/.test(tx.value)?BigInt(tx.value):typeof tx?.value==="number"&&Number.isSafeInteger(tx.value)?BigInt(tx.value):null;
    if(!tx||tx.function!=="fulfillBasicOrder_efficient_6GL6yc((address,uint256,uint256,address,address,address,uint256,uint256,uint8,uint256,uint256,bytes32,uint256,bytes32,bytes32,uint256,(uint256,address)[],bytes))"||
      tx.chain!==item.chainId||typeof tx.to!=="string"||tx.to.toLowerCase()!==listing.protocolAddress.toLowerCase()||!parameters||
      parameters.offerer.toLowerCase()!==listing.seller.toLowerCase()||parameters.offerToken.toLowerCase()!==item.contract.toLowerCase()||
      parameters.offerIdentifier!==BigInt(item.tokenId)||parameters.considerationToken.toLowerCase()!==zeroAddress||
      parameters.basicOrderType>7||value===null||value<=0n||value>BigInt(listing.price))
      return Response.json({error:"This OpenSea order needs a different checkout method. Open it on OpenSea to buy."},{status:422});
    return Response.json({to:tx.to,value:String(value),parameters:JSON.parse(JSON.stringify(parameters,(_,v)=>typeof v==="bigint"?String(v):v))},{headers:{"cache-control":"no-store"}});
  }catch{return unavailable();}
}
