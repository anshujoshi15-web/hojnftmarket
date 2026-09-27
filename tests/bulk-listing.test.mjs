import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import solc from "solc";
import {createPublicClient,createWalletClient,custom,parseEther,decodeEventLog} from "viem";

const require=createRequire(import.meta.url);
let ganache;
try{ganache=require("ganache");}catch{ganache=require("../work/evm-runtime/node_modules/ganache");}
const files=["NFTMarketplace.sol","NFTMarketplaceV4.sol","NFTMarketplaceV5.sol","NFTMarketplaceV6.sol","NFTMarketplaceV7.sol","NFTMarketplaceV8.sol"];
const sources=Object.fromEntries(files.map(name=>[name,{content:readFileSync(`contracts/${name}`,"utf8")} ]));
sources["TestNFT.sol"]={content:`// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
contract TestNFT {
  mapping(uint256=>address) public ownerOf;
  mapping(uint256=>address) public getApproved;
  mapping(address=>mapping(address=>bool)) public isApprovedForAll;
  function mint(address to,uint256 id) external {ownerOf[id]=to;}
  function setApprovalForAll(address operator,bool approved) external {isApprovedForAll[msg.sender][operator]=approved;}
  function supportsInterface(bytes4 id) external pure returns(bool){return id==0x80ac58cd || id==0x01ffc9a7;}
}`};
const output=JSON.parse(solc.compile(JSON.stringify({language:"Solidity",sources,settings:{evmVersion:"shanghai",optimizer:{enabled:true,runs:200},outputSelection:{"*":{"*":["abi","evm.bytecode.object"]}}}}),{import:path=>{try{return {contents:readFileSync(`node_modules/${path}`,"utf8")};}catch{return {error:`Missing ${path}`};}}}));
assert.deepEqual((output.errors??[]).filter(error=>error.severity==="error"),[]);
const marketplace=output.contracts["NFTMarketplaceV8.sol"].HOJNFTMarketplaceV8;
const nft=output.contracts["TestNFT.sol"].TestNFT;

test("V8 lists a collection selection atomically in one marketplace transaction",async()=>{
  const provider=ganache.provider({logging:{quiet:true},wallet:{totalAccounts:3},chain:{hardfork:"shanghai"}});
  const publicClient=createPublicClient({transport:custom(provider),pollingInterval:10});
  const wallet=createWalletClient({transport:custom(provider)});
  const [seller,other]=await wallet.getAddresses();
  const receipt=async hash=>publicClient.waitForTransactionReceipt({hash,pollingInterval:10});
  const deploy=async(artifact,args=[])=>{
    const result=await receipt(await wallet.deployContract({abi:artifact.abi,bytecode:`0x${artifact.evm.bytecode.object}`,args,account:seller,gas:8000000n,chain:null}));
    assert.equal(result.status,"success");return result.contractAddress;
  };
  const market=await deploy(marketplace,[other]),collection=await deploy(nft);
  const send=async(address,abi,functionName,args,account=seller)=>{
    const hash=await wallet.writeContract({address,abi,functionName,args,account,gas:3000000n,chain:null});
    const result=await receipt(hash);
    if(result.status!=="success") throw new Error("Transaction reverted");
    return result;
  };
  try{
    await send(collection,nft.abi,"mint",[seller,1n]);
    await send(collection,nft.abi,"mint",[seller,2n]);
    await send(collection,nft.abi,"mint",[other,3n]);
    assert.equal(await publicClient.readContract({address:market,abi:marketplace.abi,functionName:"marketplaceVersion"}),8n);
    await assert.rejects(()=>send(market,marketplace.abi,"batchList",[collection,[1n,2n],[parseEther("1"),parseEther("2")]]));
    await send(collection,nft.abi,"setApprovalForAll",[market,true]);
    const listed=await send(market,marketplace.abi,"batchList",[collection,[1n,2n],[parseEther("1"),parseEther("2")]]);
    assert.equal(listed.status,"success");
    assert.equal(listed.logs.filter(log=>{try{return decodeEventLog({abi:marketplace.abi,data:log.data,topics:log.topics}).eventName==="ItemListed";}catch{return false;}}).length,2);
    assert.equal((await publicClient.readContract({address:market,abi:marketplace.abi,functionName:"getListing",args:[collection,1n]})).price,parseEther("1"));
    await assert.rejects(()=>send(market,marketplace.abi,"batchList",[collection,[1n,3n],[parseEther("4"),parseEther("5")]]));
    assert.equal((await publicClient.readContract({address:market,abi:marketplace.abi,functionName:"getListing",args:[collection,1n]})).price,parseEther("1"));
  }finally{await provider.disconnect();}
});
