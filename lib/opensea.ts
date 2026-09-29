import { isAddress } from "viem";
import type { MarketplaceChainId } from "./marketplace-chains";

export const openSeaChains: Partial<Record<MarketplaceChainId,string>> = {
  1: "ethereum",
  137: "polygon",
  4663: "robinhood",
  8453: "base",
  33139: "ape_chain",
  7777777: "zora",
};

export type OpenSeaListing = {
  chainId: MarketplaceChainId;
  nftAddress: `0x${string}`;
  tokenId: string;
  orderHash: `0x${string}`;
  protocolAddress: `0x${string}`;
  seller: `0x${string}`;
  price: string;
  decimals: number;
  currency: string;
  url: string;
};

type RawListing = {
  asset?: {contract?:string;identifier?:string}|null;
  chain?:string;
  order_hash?:string|null;
  protocol_address?:string;
  protocol_data?:{parameters?:{offerer?:string}};
  price?:{current?:{value?:string;decimals?:number;currency?:string}};
  remaining_quantity?:number;
  status?:string;
};

export function parseOpenSeaListing(raw:RawListing, chainId:MarketplaceChainId, contract:string, tokenId:string):OpenSeaListing|null {
  const chain=openSeaChains[chainId],price=raw.price?.current;
  if(!chain||raw.chain!==chain||raw.status!=="ACTIVE"||!raw.asset||
    raw.asset.contract?.toLowerCase()!==contract.toLowerCase()||raw.asset.identifier!==tokenId||
    !raw.order_hash||!/^0x[\da-f]{64}$/i.test(raw.order_hash)||
    !raw.protocol_address||!isAddress(raw.protocol_address,{strict:false})||
    !raw.protocol_data?.parameters?.offerer||!isAddress(raw.protocol_data.parameters.offerer,{strict:false})||
    !price||!/^\d+$/.test(price.value??"")||BigInt(price.value!)<=0n||
    !Number.isInteger(price.decimals)||price.decimals!<0||price.decimals!>18||
    !price.currency||raw.remaining_quantity!==undefined&&raw.remaining_quantity<=0)return null;
  return {
    chainId,nftAddress:contract as `0x${string}`,tokenId,
    orderHash:raw.order_hash as `0x${string}`,
    protocolAddress:raw.protocol_address as `0x${string}`,
    seller:raw.protocol_data.parameters.offerer as `0x${string}`,
    price:price.value!,decimals:price.decimals!,currency:price.currency,
    url:`https://opensea.io/assets/${chain}/${contract}/${tokenId}`,
  };
}

export const basicOrderAbi=[{
  type:"function",name:"fulfillBasicOrder_efficient_6GL6yc",stateMutability:"payable",
  inputs:[{name:"parameters",type:"tuple",components:[
    {name:"considerationToken",type:"address"},{name:"considerationIdentifier",type:"uint256"},
    {name:"considerationAmount",type:"uint256"},{name:"offerer",type:"address"},
    {name:"zone",type:"address"},{name:"offerToken",type:"address"},
    {name:"offerIdentifier",type:"uint256"},{name:"offerAmount",type:"uint256"},
    {name:"basicOrderType",type:"uint8"},{name:"startTime",type:"uint256"},
    {name:"endTime",type:"uint256"},{name:"zoneHash",type:"bytes32"},
    {name:"salt",type:"uint256"},{name:"offererConduitKey",type:"bytes32"},
    {name:"fulfillerConduitKey",type:"bytes32"},{name:"totalOriginalAdditionalRecipients",type:"uint256"},
    {name:"additionalRecipients",type:"tuple[]",components:[{name:"amount",type:"uint256"},{name:"recipient",type:"address"}]},
    {name:"signature",type:"bytes"},
  ]}],outputs:[{type:"bool"}],
}] as const;

export type OpenSeaBasicOrder = {
  considerationToken:`0x${string}`;considerationIdentifier:bigint;considerationAmount:bigint;
  offerer:`0x${string}`;zone:`0x${string}`;offerToken:`0x${string}`;
  offerIdentifier:bigint;offerAmount:bigint;basicOrderType:number;startTime:bigint;
  endTime:bigint;zoneHash:`0x${string}`;salt:bigint;offererConduitKey:`0x${string}`;
  fulfillerConduitKey:`0x${string}`;totalOriginalAdditionalRecipients:bigint;
  additionalRecipients:Array<{amount:bigint;recipient:`0x${string}`}>;signature:`0x${string}`;
};

export function parseBasicOrder(value:unknown):OpenSeaBasicOrder|null {
  if(!value||typeof value!=="object")return null;
  const p=value as Record<string,unknown>;
  const address=(name:string)=>typeof p[name]==="string"&&isAddress(p[name],{strict:false})?p[name] as `0x${string}`:null;
  const uint=(name:string)=>typeof p[name]==="string"&&/^\d+$/.test(p[name])||typeof p[name]==="number"&&Number.isSafeInteger(p[name])&&p[name]>=0?BigInt(p[name] as string|number):null;
  const bytes=(name:string,length?:number)=>typeof p[name]==="string"&&new RegExp(`^0x[0-9a-fA-F]{${length===undefined?"2,":""+length}}$`).test(p[name])&&((p[name] as string).length-2)%2===0?p[name] as `0x${string}`:null;
  const recipients=Array.isArray(p.additionalRecipients)?p.additionalRecipients.map(item=>{
    if(!item||typeof item!=="object")return null;
    const r=item as Record<string,unknown>;
    if(typeof r.amount!=="string"||!/^\d+$/.test(r.amount)||typeof r.recipient!=="string"||!isAddress(r.recipient,{strict:false}))return null;
    return {amount:BigInt(r.amount),recipient:r.recipient as `0x${string}`};
  }):null;
  const numeric=["considerationIdentifier","considerationAmount","offerIdentifier","offerAmount","basicOrderType","startTime","endTime","salt","totalOriginalAdditionalRecipients"] as const;
  if(numeric.some(name=>uint(name)===null)||!recipients||recipients.some(item=>item===null)||
    !address("considerationToken")||!address("offerer")||!address("zone")||!address("offerToken")||
    !bytes("zoneHash",64)||!bytes("offererConduitKey",64)||!bytes("fulfillerConduitKey",64)||!bytes("signature"))return null;
  return {
    considerationToken:address("considerationToken")!,considerationIdentifier:uint("considerationIdentifier")!,
    considerationAmount:uint("considerationAmount")!,offerer:address("offerer")!,zone:address("zone")!,
    offerToken:address("offerToken")!,offerIdentifier:uint("offerIdentifier")!,offerAmount:uint("offerAmount")!,
    basicOrderType:Number(uint("basicOrderType")),startTime:uint("startTime")!,endTime:uint("endTime")!,
    zoneHash:bytes("zoneHash",64)!,salt:uint("salt")!,offererConduitKey:bytes("offererConduitKey",64)!,
    fulfillerConduitKey:bytes("fulfillerConduitKey",64)!,totalOriginalAdditionalRecipients:uint("totalOriginalAdditionalRecipients")!,
    additionalRecipients:recipients as OpenSeaBasicOrder["additionalRecipients"],signature:bytes("signature")!,
  };
}
