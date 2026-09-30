import test from "node:test";
import assert from "node:assert/strict";
import { loadModule } from "./load-module.mjs";

const nft="0x1111111111111111111111111111111111111111";
const market="0x2222222222222222222222222222222222222222";
const owner="0x3333333333333333333333333333333333333333";

test("listing inspection identifies an ERC-1155 before requesting ERC-721 approval",async()=>{
  const {inspectListing}=await loadModule("lib/prepare-listing.ts");
  const calls=[];
  const client={readContract:async request=>{
    calls.push(request.functionName);
    if(request.functionName==="ownerOf")throw new Error('The contract function "ownerOf" reverted.');
    if(request.functionName==="supportsInterface")return true;
    throw new Error(`Unexpected ${request.functionName}`);
  }};
  await assert.rejects(inspectListing(client,market,nft,1n,owner),/ERC-1155 edition/);
  assert.deepEqual(calls,["ownerOf","supportsInterface"]);
});

test("unknown ownership failure names the token and asks for contract and network checks",async()=>{
  const {readErc721Owner}=await loadModule("lib/prepare-listing.ts");
  const client={readContract:async request=>{
    if(request.functionName==="ownerOf")throw new Error('The contract function "ownerOf" reverted.');
    return false;
  }};
  await assert.rejects(readErc721Owner(client,nft,42n),/token #42.*contract, token ID, and network/);
});

test("collection-wide approval permits listing without a token approval read",async()=>{
  const {inspectListing}=await loadModule("lib/prepare-listing.ts");
  const calls=[];
  const client={readContract:async request=>{
    calls.push(request.functionName);
    if(request.functionName==="ownerOf")return owner;
    if(request.functionName==="getListing")return {price:0n,seller:owner};
    if(request.functionName==="isApprovedForAll")return true;
    throw new Error(`Unexpected ${request.functionName}`);
  }};
  assert.deepEqual(await inspectListing(client,market,nft,1n,owner),{needsApproval:false});
  assert.equal(calls.includes("getApproved"),false);
});
