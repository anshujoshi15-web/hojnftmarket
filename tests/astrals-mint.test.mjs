import test from "node:test";
import assert from "node:assert/strict";
import { loadModule } from "./load-module.mjs";
const {astralsMintQuote}=await loadModule("lib/astrals-mint.ts");
const address="0x1111111111111111111111111111111111111111";
const snapshot=()=>({drop:{mintPrice:25n*10n**18n,startTime:100,endTime:200,maxTotalMintableByWallet:2},payout:address,recipients:[address],stats:[0n,200n,7777n],timestamp:150n});
test("Astrals quote uses configured fee recipient and native Arc payment",()=>{
  assert.deepEqual(astralsMintQuote(snapshot(),2),{value:50n*10n**18n,feeRecipient:address});
});
test("Astrals mint rejects closed sales, changed terms, exhausted wallets and supply",()=>{
  for(const change of [d=>d.timestamp=99n,d=>d.timestamp=201n,d=>d.drop.mintPrice=1n,d=>d.drop.maxTotalMintableByWallet=7777,d=>d.stats[0]=2n,d=>d.stats[1]=7777n,d=>d.stats[1]=0n,d=>d.recipients=[]]){
    const data=snapshot();change(data);assert.throws(()=>astralsMintQuote(data,1));
  }
  assert.throws(()=>astralsMintQuote(snapshot(),3));
});
