import test from "node:test";
import assert from "node:assert/strict";
import { encodeFunctionData, zeroAddress } from "viem";
import { loadModule } from "./load-module.mjs";

const {parseOpenSeaListing,parseBasicOrder,basicOrderAbi}=await loadModule("lib/opensea.ts");
const contract="0x1111111111111111111111111111111111111111";
const seller="0x2222222222222222222222222222222222222222";
const protocol="0x3333333333333333333333333333333333333333";
const hash=`0x${"a".repeat(64)}`;

test("OpenSea order must match the requested NFT and active chain",()=>{
  const raw={asset:{contract,identifier:"7"},chain:"base",status:"ACTIVE",order_hash:hash,protocol_address:protocol,protocol_data:{parameters:{offerer:seller}},price:{current:{value:"100000000000000000",decimals:18,currency:"ETH"}},remaining_quantity:1};
  const listing=parseOpenSeaListing(raw,8453,contract,"7");
  assert.equal(listing?.orderHash,hash);
  assert.equal(parseOpenSeaListing(raw,137,contract,"7"),null);
  assert.equal(parseOpenSeaListing(raw,8453,contract,"8"),null);
  assert.equal(parseOpenSeaListing({...raw,status:"FULFILLED"},8453,contract,"7"),null);
});

test("validated basic order encodes Seaport checkout parameters",()=>{
  const raw={considerationToken:zeroAddress,considerationIdentifier:"0",considerationAmount:"100",offerer:seller,zone:zeroAddress,offerToken:contract,offerIdentifier:"7",offerAmount:"1",basicOrderType:"0",startTime:"1",endTime:"9999999999",zoneHash:`0x${"0".repeat(64)}`,salt:"1",offererConduitKey:`0x${"0".repeat(64)}`,fulfillerConduitKey:`0x${"0".repeat(64)}`,totalOriginalAdditionalRecipients:"0",additionalRecipients:[],signature:`0x${"a".repeat(130)}`};
  const parsed=parseBasicOrder(raw);
  assert.ok(parsed);
  assert.equal(parsed.offerIdentifier,7n);
  assert.match(encodeFunctionData({abi:basicOrderAbi,functionName:"fulfillBasicOrder_efficient_6GL6yc",args:[parsed]}),/^0x[\da-f]+$/);
  assert.equal(parseBasicOrder({...raw,offerer:"bad"}),null);
});
