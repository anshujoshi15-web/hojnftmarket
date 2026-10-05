import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { encodeAbiParameters, encodeEventTopics, parseEther } from "viem";
import { loadModule } from "./load-module.mjs";
const {marketplaceAbi,parseNativeAmount}=await loadModule("lib/marketplace-abi.ts");
const {decodeMarketplaceLogs,replayEvents,eventStatements,rangeLogs,indexClient,loadMarketplaceIndex,explorerLogs}=await loadModule("lib/marketplace-index.ts");
const {sortActivity}=await loadModule("lib/activity-sort.ts");
const {confirmedReceipt}=await loadModule("lib/transaction-receipt.ts");
const seller="0x1111111111111111111111111111111111111111",buyer="0x2222222222222222222222222222222222222222",nft="0x3333333333333333333333333333333333333333";
const hash=`0x${"ab".repeat(32)}`;
test("Base index scans prefer the historical provider over recent-only PublicNode",async()=>{
  const originalFetch=globalThis.fetch;
  const urls=[];
  globalThis.fetch=async(url,options)=>{
    urls.push(String(url));
    const request=JSON.parse(options.body);
    return Response.json({jsonrpc:"2.0",id:request.id,result:"0x10"});
  };
  try{
    const client=indexClient({chain:{id:8453},rpcUrl:"https://base-rpc.publicnode.com"});
    assert.equal(await client.getBlockNumber({cacheTime:0}),16n);
    assert.deepEqual(urls.map(url=>new URL(url).origin),["https://base.gateway.tenderly.co"]);
  }finally{globalThis.fetch=originalFetch;}
});
function log(eventName,args,index){
  const event=marketplaceAbi.find(item=>item.type==="event"&&item.name===eventName);
  const values=event.inputs.filter(input=>!input.indexed);
  return {topics:encodeEventTopics({abi:marketplaceAbi,eventName,args}),data:encodeAbiParameters(values,values.map(input=>args[input.name])),transactionHash:hash,blockNumber:"0xa",logIndex:`0x${index.toString(16)}`};
}
const logs=[
  log("ItemListed",{seller,nftAddress:nft,tokenId:1n,price:parseEther("1")},0),
  log("OfferMade",{buyer,nftAddress:nft,tokenId:1n,amount:parseEther("0.1"),expiresAt:2000n},1),
  log("OfferMade",{buyer,nftAddress:nft,tokenId:1n,amount:parseEther("0.2"),expiresAt:3000n},2),
  log("OfferAccepted",{seller,buyer,nftAddress:nft,tokenId:1n,amount:parseEther("0.2"),marketplaceFee:4n,royaltyRecipient:seller,royaltyAmount:5n},3),
];
test("range-limited RPC scans include logs from both halves",async()=>{
  const client={request:async({params})=>{
    const {fromBlock,toBlock}=params[0];
    const start=Number(BigInt(fromBlock)),end=Number(BigInt(toBlock));
    if(end-start+1>2)throw new Error("eth_getLogs block range limit exceeded");
    return [start,end].map(block=>({blockNumber:`0x${block.toString(16)}`}));
  }};
  const result=await rangeLogs(client,seller,1,8);
  assert.equal(result.through,8);
  assert.deepEqual(result.logs.map(item=>Number(BigInt(item.blockNumber))),[1,2,3,4,5,6,7,8]);
});
test("stateless indexing scans from deployment even beyond the old recent-block window",async()=>{
  const originalFetch=globalThis.fetch;
  const ranges=[];
  globalThis.fetch=async(url,options)=>{
    const request=JSON.parse(options.body);
    if(request.method==="eth_getLogs")ranges.push(request.params[0]);
    return Response.json({jsonrpc:"2.0",id:request.id,result:request.method==="eth_blockNumber"?"0x400000":[]});
  };
  try{
    const result=await loadMarketplaceIndex({chain:{id:4663,confirmations:12},address:seller,deployBlock:"1",rpcUrl:"https://indexer-test.invalid"});
    assert.equal(ranges[0].fromBlock,"0x1");
    assert.equal(ranges[0].toBlock,"0x400000");
    assert.equal(result.sync.caughtUp,true);
  }finally{globalThis.fetch=originalFetch;}
});
test("split scans checkpoint completed ranges before a later provider failure",async()=>{
  const completed=[];
  const client={request:async({params})=>{
    const start=Number(BigInt(params[0].fromBlock)),end=Number(BigInt(params[0].toBlock));
    if(end-start+1>2)throw new Error("requested range too large");
    if(start>2)throw new Error("provider unavailable");
    return [];
  }};
  await assert.rejects(()=>rangeLogs(client,seller,1,4,async(logs,through)=>{completed.push(through);}),/provider unavailable/);
  assert.deepEqual(completed,[2]);
});
test("explorer history follows every page and excludes unindexed or out-of-range blocks",async()=>{
  const originalFetch=globalThis.fetch;
  const requests=[];
  const item=(block,index)=>({block_number:block,index,topics:[],data:"0x",transaction_hash:hash,block_timestamp:"2026-10-05T00:00:00Z"});
  globalThis.fetch=async input=>{
    const url=new URL(input);requests.push(url);
    if(url.pathname.endsWith("/blocks"))return Response.json({items:[{height:100}]});
    if(url.searchParams.has("index"))return Response.json({items:[item(50,1),item(9,0)],next_page_params:null});
    return Response.json({items:[item(101,3),item(100,2)],next_page_params:{index:2,block_number:100}});
  };
  try{
    const result=await explorerLogs("https://explorer-test.invalid/api/v2",seller,10,110);
    assert.equal(result.through,100);
    assert.deepEqual(result.logs.map(log=>Number(BigInt(log.blockNumber))),[100,50]);
    assert.equal(requests.length,3);
    assert.equal(requests[2].searchParams.get("index"),"2");
  }finally{globalThis.fetch=originalFetch;}
});
test("rate-limited log reads retry the same range without splitting it",async()=>{
  let calls=0;
  const client={request:async()=>{
    calls++;
    if(calls<3)throw new Error("429 rate limit exceeded");
    return [];
  }};
  const result=await rangeLogs(client,seller,1,8000);
  assert.equal(calls,3);
  assert.equal(result.through,8000);
  assert.deepEqual(result.logs,[]);
});
test("amounts retain exact native units and reject malformed, nonpositive or overprecise input",()=>{
  assert.equal(parseNativeAmount("0.1"),100000000000000000n);
  assert.equal(parseNativeAmount("1"),1000000000000000000n);
  assert.equal(parseNativeAmount("0.000000000000000001"),1n);
  for(const input of ["0","-1","1e3","NaN","Infinity","0.0000000000000000001","1.2.3","", "9".repeat(90)])assert.throws(()=>parseNativeAmount(input));
});
test("offer acceptance deactivates the listing and funded offer in stateless replay",()=>{
  const events=decodeMarketplaceLogs(137,[...logs].reverse());
  const before=replayEvents(events.slice(0,3));
  assert.equal(before.offers.length,1);assert.equal(before.offers[0].amount,parseEther("0.2").toString());
  const after=replayEvents(events);assert.equal(after.listings.length,0);assert.equal(after.offers.length,0);assert.equal(after.activity.at(-1).eventType,"offer_accepted");
});
test("cancellation removes only the matching buyer's offer",()=>{
  const events=decodeMarketplaceLogs(109,[logs[1],log("OfferMade",{buyer:seller,nftAddress:nft,tokenId:1n,amount:1n,expiresAt:3000n},2),log("OfferCanceled",{buyer,nftAddress:nft,tokenId:1n,amount:parseEther("0.1")},3)]);
  const replay=replayEvents(events);assert.equal(replay.offers.length,1);assert.equal(replay.offers[0].buyer.toLowerCase(),seller);
});
test("persistent SQL replay matches stateless offer settlement and is idempotent",()=>{
  const db=new DatabaseSync(":memory:");
  db.exec(`CREATE TABLE marketplace_v3_listings(scope,id,chain_id,nft_address,token_id,seller,price,active,transaction_hash,created_block,updated_block,PRIMARY KEY(scope,id));
  CREATE TABLE marketplace_v3_activity(scope,id,chain_id,event_type,nft_address,token_id,seller,buyer,price,marketplace_fee,royalty_recipient,royalty_amount,transaction_hash,block_number,log_index,timestamp,PRIMARY KEY(scope,id));
  CREATE TABLE marketplace_v3_offers(scope,id,chain_id,nft_address,token_id,buyer,amount,expires_at,status,transaction_hash,block_number,PRIMARY KEY(scope,id));`);
  const adapter={prepare(sql){return {bind(...args){return {sql,args};}};}};
  const events=decodeMarketplaceLogs(137,logs).map(e=>({...e,timestamp:1000}));
  for(let run=0;run<2;run++)for(const statement of eventStatements(adapter,"137:market",events))db.prepare(statement.sql).run(...statement.args);
  assert.equal(db.prepare("SELECT active FROM marketplace_v3_listings").get().active,0);
  assert.equal(db.prepare("SELECT status FROM marketplace_v3_offers").get().status,"accepted");
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM marketplace_v3_activity").get().count,4);
  assert.equal(db.prepare("SELECT timestamp FROM marketplace_v3_activity LIMIT 1").get().timestamp,1000);
  db.close();
});
test("cross-chain recency uses timestamps and cross-currency price sorting is disabled",()=>{
  const a={chainId:1,timestamp:200,blockNumber:10,price:"1"},b={chainId:137,timestamp:100,blockNumber:99999999,price:"1000000"};
  assert.equal(sortActivity([b,a],"recent","all")[0],a);
  assert.equal(sortActivity([b,a],"price-high","all")[0],a);
  const c={...a,price:"9007199254740993"},d={...a,price:"9007199254740992"};
  assert.equal(sortActivity([d,c],"price-high",1)[0],c);
});
test("transaction tracking rejects reverted, canceled and changed transactions, accepts fee bumps",async()=>{
  await assert.rejects(()=>confirmedReceipt({waitForTransactionReceipt:async()=>({status:"reverted"})},hash),/failed on chain/);
  for(const reason of ["cancelled","replaced"]){
    await assert.rejects(()=>confirmedReceipt({waitForTransactionReceipt:async({onReplaced})=>{onReplaced({reason,transaction:{hash}});return {status:"success"};}},hash),/canceled or replaced/);
  }
  const result=await confirmedReceipt({waitForTransactionReceipt:async({onReplaced})=>{onReplaced({reason:"repriced",transaction:{hash}});return {status:"success"};}},hash);
  assert.equal(result.status,"success");
});
test("mock offer mutation endpoints reject writes",async()=>{
  const {POST,PUT}=await loadModule("app/api/offers/route.ts");
  for(const method of [POST,PUT]){const response=await method(new Request("http://localhost/api/offers",{method:"POST",body:JSON.stringify({offerer:buyer,amount:"1",action:"accept"})}));assert.equal(response.status,405);assert.equal(response.headers.get("Allow"),"GET");}
});
