import test from "node:test";
import assert from "node:assert/strict";
import { loadModule } from "./load-module.mjs";

test("configured chains resolve independently with the correct native currencies",async()=>{
  const {chainConfig}=await loadModule("lib/server-marketplace-config.ts");
  const polygon=chainConfig({POLYGON_MARKETPLACE_ADDRESS:"0x1111111111111111111111111111111111111111"},137);
  const base=chainConfig({},8453);
  assert.equal(polygon.chain.currency,"POL");assert.equal(base.chain.currency,"ETH");
  assert.notEqual(polygon.address,base.address);
  assert.equal(base.address,"0x50489Fdc2352917595359667b34b384b33184b91");
  assert.equal(base.deployBlock,"51813478");
  assert.equal(base.rpcUrl,"https://base-rpc.publicnode.com");
  assert.equal(polygon.chain.marketplaceStatus,"live");
  assert.equal(chainConfig({},137).address,"0x3C626ff68e9a69526117B22D288ab71bdA2B377a");
  assert.equal(chainConfig({},137).deployBlock,"94475428");
  const cronos=chainConfig({},25);
  assert.equal(cronos.chain.currency,"CRO");
  assert.equal(cronos.address,"0x74cE4e02E754DAdc3BA27CB4f8678538F0833eab");
  assert.equal(cronos.deployBlock,"96267649");
  assert.equal(chainConfig({},109).chain.currency,"BONE");assert.equal(chainConfig({},33139).chain.currency,"APE");
  assert.equal(chainConfig({},109).address,"0x455DaD76334a67660D61bb319d8CfF1010e33049");
  assert.equal(chainConfig({},109).deployBlock,"19169320");
  const zora=chainConfig({},7777777);
  assert.equal(zora.chain.marketplaceStatus,"live");
  assert.equal(zora.address,"0x74cE4e02E754DAdc3BA27CB4f8678538F0833eab");
  assert.equal(zora.deployBlock,"51861519");
  const arc=chainConfig({},5042);
  assert.equal(arc.chain.currency,"USDC");
  assert.equal(arc.chain.marketplaceStatus,"live");
  assert.equal(arc.address,"0xD9883fDdf57Ca58f775Bdab96C0e7c3F1c918af3");
  assert.equal(arc.deployBlock,"22840359");
  assert.equal(arc.rpcUrl,"https://rpc.mainnet.arc.io");
  const apechain=chainConfig({},33139);
  assert.equal(apechain.chain.marketplaceStatus,"live");
  assert.equal(apechain.address,"0x6aCaf964bCf4551CC55Afaf12d6e6a8ef7138875");
  assert.equal(apechain.deployBlock,"50360444");
});
test("V8 configuration retains the earlier marketplace address and block",async()=>{
  const {legacyChainConfig}=await loadModule("lib/server-marketplace-config.ts");
  const next="0x1111111111111111111111111111111111111111";
  assert.equal(legacyChainConfig({},8453),null);
  const old=legacyChainConfig({BASE_MARKETPLACE_ADDRESS:next,BASE_MARKETPLACE_DEPLOY_BLOCK:"52000000"},8453);
  assert.equal(old?.address,"0x50489Fdc2352917595359667b34b384b33184b91");
  assert.equal(old?.deployBlock,"51813478");
  const explicit=legacyChainConfig({BASE_MARKETPLACE_ADDRESS:next,BASE_LEGACY_MARKETPLACE_ADDRESS:"0x2222222222222222222222222222222222222222",BASE_LEGACY_MARKETPLACE_DEPLOY_BLOCK:"123"},8453);
  assert.equal(explicit?.address,"0x2222222222222222222222222222222222222222");
  assert.equal(explicit?.deployBlock,"123");
});
test("coming-soon networks expose no live marketplace listings",async()=>{
  const {GET}=await loadModule("app/api/indexer/route.ts");
  for(const chainId of [1,4663]){
    const response=await GET(new Request(`http://localhost/api/indexer?chainId=${chainId}`));
    const body=await response.json();
    assert.equal(response.status,200);
    assert.equal(body.configured,false);
    assert.equal(body.status,"coming-soon");
    assert.deepEqual(body.listings,[]);
  }
});
test("NFT price history keeps only recorded listing and settlement prices in time order",async()=>{
  const {toPriceHistoryPoints}=await loadModule("lib/nft-price-history.ts");
  const base={chainId:8453,nftAddress:"0x1111111111111111111111111111111111111111",tokenId:"7",seller:null,buyer:null,marketplaceFee:null,royaltyRecipient:null,royaltyAmount:null,transactionHash:`0x${"a".repeat(64)}`,timestamp:100,logIndex:0};
  const points=toPriceHistoryPoints([
    {...base,id:"sale",eventType:"sold",price:"200",blockNumber:12},
    {...base,id:"offer",eventType:"offer",price:"300",blockNumber:11},
    {...base,id:"list",eventType:"listed",price:"100",blockNumber:10},
  ]);
  assert.deepEqual(points.map(point=>[point.eventType,point.price]),[["listed","100"],["sold","200"]]);
});
test("coming-soon NFT price history returns a truthful empty state",async()=>{
  const {GET}=await loadModule("app/api/nft-price-history/route.ts");
  const response=await GET(new Request("http://localhost/api/nft-price-history?chainId=4663&contract=0x1111111111111111111111111111111111111111&tokenId=7"));
  assert.equal(response.status,200);
  const body=await response.json();
  assert.deepEqual(body.points,[]);
  assert.match(body.warning,/coming soon/i);
});
test("indexer rejects unsupported networks without issuing RPC requests",async()=>{
  const {GET}=await loadModule("app/api/indexer/route.ts");
  const response=await GET(new Request("http://localhost/api/indexer?chainId=999"));
  assert.equal(response.status,400);assert.equal((await response.json()).configured,false);
});
