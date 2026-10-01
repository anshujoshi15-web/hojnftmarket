import { env } from "@runtime-env";
import { isAddress } from "viem";
import { isMarketplaceChainId } from "@/lib/marketplace-chains";
import { chainConfig, legacyChainConfig, type RuntimeEnv } from "@/lib/server-marketplace-config";
import { loadMarketplaceIndex } from "@/lib/marketplace-index";

export const dynamic = "force-dynamic";
export async function GET(request:Request){
  const chainId=Number(new URL(request.url).searchParams.get("chainId")??109);
  if(!isMarketplaceChainId(chainId))return Response.json({error:"Unsupported chain",configured:false,listings:[],activity:[],offers:[]},{status:400});
  const runtime=env as unknown as RuntimeEnv,config=chainConfig(runtime,chainId);
  const base={chainId,chain:config.chain.name,currency:config.chain.currency,explorerUrl:config.chain.explorerUrl};
  if(config.chain.marketplaceStatus!=="live")return Response.json({...base,configured:false,status:"coming-soon",listings:[],collections:[],activity:[],offers:[],sync:null});
  const old=legacyChainConfig(runtime,chainId);
  const legacy=new URL(request.url).searchParams.get("legacy")==="1";
  const selected=legacy&&old?old:config;
  if(legacy&&!old)return Response.json({...base,configured:false,listings:[],collections:[],activity:[],offers:[],sync:null},{status:404});
  if(!isAddress(selected.address,{strict:false})||!/^\d+$/.test(selected.deployBlock))return Response.json({...base,configured:false,listings:[],collections:[],activity:[],offers:[],sync:null});
  try{
    const result=await loadMarketplaceIndex(selected,runtime.DB);
    return Response.json({...base,configured:true,marketplaceAddress:selected.address,legacyMarketplaceAddress:old?.address??null,...result},{headers:{"cache-control":"public, max-age=0, s-maxage=15, stale-while-revalidate=30"}});
  }catch(error){
    // viem errors contain full RPC URLs, which can embed private API credentials.
    const message=String(error);
    const syncError=/archive|pruned|personal token/i.test(message)?"Historical indexing needs an archive-capable RPC provider for this network.":/429|rate limit|compute units/i.test(message)?"The network provider rate limit was reached. Indexing will resume on retry.":runtime.DB?"The network indexer is temporarily unavailable. Saved indexing progress is retained; please retry.":"The network indexer is temporarily unavailable. Historical completeness requires a persistent database on this host.";
    return Response.json({...base,configured:true,marketplaceAddress:selected.address,legacyMarketplaceAddress:old?.address??null,listings:[],collections:[],activity:[],offers:[],sync:null,syncError},{status:503,headers:{"cache-control":"no-store"}});
  }
}
