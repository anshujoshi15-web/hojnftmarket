import test from "node:test";
import assert from "node:assert/strict";
import { loadModule } from "./load-module.mjs";

const owner="0x06753AC9405c473324655EB1174d79471745564B";
const contract="0x007Bbf85988cAF18Cf4222C9214e4fa019b3e002";
const request=new Request(`http://localhost/api/wallet-nfts?owner=${owner}&chainId=109`);

test("wallet holdings retries a throttled explorer and keeps NFT metadata",async()=>{
  const {GET}=await loadModule("app/api/wallet-nfts/route.ts");
  const originalFetch=globalThis.fetch;
  let calls=0;
  globalThis.fetch=async()=>{
    calls++;
    if(calls===1)return new Response("rate limited",{status:429});
    return Response.json({items:[{id:"42",value:"1",token_type:"ERC-721",token:{address_hash:contract,name:"Shib Magazine Covers",type:"ERC-721"},metadata:{name:"Cover #42",image:"ipfs://bafybeiexample/42.png"}}],next_page_params:null});
  };
  try{
    const response=await GET(request);
    const body=await response.json();
    assert.equal(response.status,200);
    assert.equal(body.complete,true);
    assert.equal(calls,2);
    assert.equal(body.nfts.length,1);
    assert.equal(body.nfts[0].tokenId,"42");
    assert.equal(body.nfts[0].collection,"Shib Magazine Covers");
    assert.match(body.nfts[0].imageUrl,/\/api\/nft-image\?/);
  }finally{globalThis.fetch=originalFetch;}
});

test("wallet holdings keep a partial page but never label it complete",async()=>{
  const {GET}=await loadModule("app/api/wallet-nfts/route.ts");
  const originalFetch=globalThis.fetch;
  let calls=0;
  globalThis.fetch=async()=>{
    calls++;
    if(calls===1)return Response.json({items:[{id:"42",token:{address_hash:contract,name:"Magazine"}}],next_page_params:{token_id:"42",items_count:50}});
    return new Response("provider failed",{status:403});
  };
  try{
    const response=await GET(request);
    const body=await response.json();
    assert.equal(response.status,200);
    assert.equal(body.complete,false);
    assert.equal(body.nfts.length,1);
    assert.ok(body.warnings.length>0);
  }finally{globalThis.fetch=originalFetch;}
});

test("Cronos wallet holdings use paginated indexed collections without a false completeness claim",async()=>{
  const {GET}=await loadModule("app/api/wallet-nfts/route.ts");
  const originalFetch=globalThis.fetch;
  const pages=[];
  globalThis.fetch=async input=>{
    const url=new URL(input);
    assert.equal(url.hostname,"api.ebisusbay.com");
    assert.equal(url.searchParams.get("blacklist"),"0,1,4");
    const page=Number(url.searchParams.get("page"));pages.push(page);
    return Response.json({page,totalPages:2,totalCount:2,nfts:[{
      nftId:String(page),nftAddress:contract,chain:25,owner:owner.toLowerCase(),burnt:false,
      is1155:page===2,balance:page===2?"3":undefined,name:`Cronos #${page}`,
      image:"ipfs://bafyexample/image.png",collectionName:"Cronos Collection",
    }]});
  };
  try{
    const response=await GET(new Request(`http://localhost/api/wallet-nfts?owner=${owner}&chainId=25`));
    const body=await response.json();
    assert.equal(response.status,200);
    assert.equal(body.coverage,"indexed-collections");
    assert.equal(body.complete,false);
    assert.deepEqual(pages,[1,2]);
    assert.deepEqual(body.nfts.map(nft=>[nft.tokenId,nft.tokenType,nft.quantity]),[["1","ERC-721","1"],["2","ERC-1155","3"]]);
  }finally{globalThis.fetch=originalFetch;}
});

test("Cronos falls back to supported RPC log windows when indexed collections are empty",async()=>{
  const {GET}=await loadModule("app/api/wallet-nfts/route.ts");
  const originalFetch=globalThis.fetch;
  let logQueries=0;
  globalThis.fetch=async (input,options)=>{
    if(String(input).includes("api.ebisusbay.com"))return Response.json({page:1,totalPages:1,totalCount:0,nfts:[]});
    const request=JSON.parse(options.body);
    if(request.method==="eth_blockNumber")return Response.json({jsonrpc:"2.0",id:1,result:"0x5000"});
    if(request.method==="eth_getLogs"){
      logQueries++;
      const [from,to]=[request.params[0].fromBlock,request.params[0].toBlock].map(value=>Number(BigInt(value)));
      assert.ok(to-from<2000);
      return Response.json({jsonrpc:"2.0",id:1,result:logQueries===1?[{address:contract,topics:["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef","0x"+"0".repeat(64),"0x"+owner.slice(2).toLowerCase().padStart(64,"0"),"0x"+"0".repeat(63)+"7"]}]:[]});
    }
    if(request.method==="eth_call")return Response.json({jsonrpc:"2.0",id:1,result:"0x"+owner.slice(2).toLowerCase().padStart(64,"0")});
    throw new Error(`Unexpected RPC method ${request.method}`);
  };
  try{
    const response=await GET(new Request(`http://localhost/api/wallet-nfts?owner=${owner}&chainId=25`));
    const body=await response.json();
    assert.equal(response.status,200);
    assert.equal(body.complete,false);
    assert.ok(logQueries>1&&logQueries<=11);
    assert.deepEqual(body.nfts.map(nft=>nft.tokenId),["7"]);
  }finally{globalThis.fetch=originalFetch;}
});
