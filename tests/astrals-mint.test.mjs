import test from "node:test";
import assert from "node:assert/strict";
import { loadModule } from "./load-module.mjs";
const {astralsMintQuote}=await loadModule("lib/astrals-mint.ts");
const address="0x1111111111111111111111111111111111111111";
const snapshot=()=>({drop:{mintPrice:25n*10n**18n,startTime:100,endTime:200,maxTotalMintableByWallet:7777},payout:address,recipients:[address],stats:[0n,200n,7777n],timestamp:150n});
test("Astrals quote uses configured fee recipient and native Arc payment",()=>{
  assert.deepEqual(astralsMintQuote(snapshot(),2),{value:50n*10n**18n,feeRecipient:address});
});
test("Astrals mint rejects closed sales, changed terms, exhausted wallets and supply",()=>{
  for(const change of [d=>d.timestamp=99n,d=>d.timestamp=201n,d=>d.drop.mintPrice=1n,d=>d.drop.maxTotalMintableByWallet=0,d=>d.stats[0]=7777n,d=>d.stats[1]=7777n,d=>d.stats[1]=0n,d=>d.recipients=[]]){
    const data=snapshot();change(data);assert.throws(()=>astralsMintQuote(data,1));
  }
  assert.throws(()=>astralsMintQuote(snapshot(),0));
  assert.throws(()=>astralsMintQuote(snapshot(),1.5));
});

test("Astrals allows quantities and cumulative mints above two",()=>{
  const data=snapshot(); data.stats[0]=5n;
  assert.equal(astralsMintQuote(data,10).value,250n*10n**18n);
  data.drop.maxTotalMintableByWallet=6;
  assert.throws(()=>astralsMintQuote(data,2),/onchain mint allowance/);
});
