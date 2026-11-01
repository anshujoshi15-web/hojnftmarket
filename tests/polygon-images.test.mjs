import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {NextRequest} from 'next/server.js';
import {encodeAbiParameters} from 'viem';
await mkdir('work/test-modules',{recursive:true});
const outfile=path.resolve(`work/test-modules/${process.pid}-polygon-image.mjs`);
await build({entryPoints:['app/api/nft-image/route.ts'],outfile,bundle:true,platform:'node',format:'esm',packages:'external',alias:{'next/server':'next/server.js'},logLevel:'silent',plugins:[{name:'test-env',setup(build){build.onResolve({filter:/^@runtime-env$/},()=>({path:'env',namespace:'test'}));build.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export const env = { ALCHEMY_API_KEY: "test-key" };',loader:'js'}));}}]});
const {GET}=await import(pathToFileURL(outfile).href);
test('Polygon image resolver tries cached renditions when original and cached image fail',async()=>{
 const original=globalThis.fetch,requests=[];
 globalThis.fetch=async(url)=>{
  const value=String(url);requests.push(value);
  if(value.includes('/getNFTMetadata?'))return Response.json({raw:{metadata:{image:'https://art.invalid/original'}},image:{cachedUrl:'https://art.invalid/cache',pngUrl:'https://art.invalid/working.png'}});
  if(value==='https://art.invalid/working.png'){
   const response=new Response(new Uint8Array([1]),{headers:{'content-type':'image/png'}});
   Object.defineProperty(response,'url',{value});return response;
  }
  return new Response(null,{status:404});
 };
 try{
  const response=await GET(new NextRequest('https://marketplace.test/api/nft-image?chainId=137&contract=0xae3520842d5a25e6e68e07906d37a3e6c0807c51&tokenId=1&source=https%3A%2F%2Fart.invalid%2Foriginal'));
  assert.equal(response.status,307);
  assert.equal(response.headers.get('location'),'https://art.invalid/working.png');
  assert.ok(requests.includes('https://art.invalid/cache'));
 }finally{globalThis.fetch=original;}
});

test('empty explorer media falls back to onchain metadata instead of returning null artwork',async()=>{
 const metadataFile=path.resolve(`work/test-modules/${process.pid}-polygon-metadata.mjs`);
 await build({entryPoints:['app/api/nft/route.ts'],outfile:metadataFile,bundle:true,platform:'node',format:'esm',packages:'external',alias:{'next/server':'next/server.js'},logLevel:'silent',plugins:[{name:'test-env',setup(build){build.onResolve({filter:/^@runtime-env$/},()=>({path:'env',namespace:'test'}));build.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export const env = {};',loader:'js'}));}}]});
 const {GET:metadataGET}=await import(pathToFileURL(metadataFile).href);
 const original=globalThis.fetch;
 const cid='QmdWc6vGdmZGNAy5TAPX6DEqsL2QH6ua1DRDrNPqnXeXdG';
 globalThis.fetch=async(url,options)=>{
  if(String(url).includes('/instances/'))return Response.json({token:{name:'Mergirlz Vol. 2'},metadata:null});
  const rpc=JSON.parse(options.body);
  const uri='data:application/json,'+encodeURIComponent(JSON.stringify({name:'MG artwork',image:`ipfs://${cid}/image.png`}));
  return Response.json({jsonrpc:'2.0',id:rpc.id,result:encodeAbiParameters([{type:'string'}],[uri])});
 };
 try{
  const response=await metadataGET(new NextRequest('https://marketplace.test/api/nft?chainId=137&contract=0xae3520842d5a25e6e68e07906d37a3e6c0807c51&tokenId=123&refresh=1'));
  const data=await response.json();
  assert.equal(data.name,'MG artwork');
  assert.ok(data.imageUrl.startsWith('/api/nft-image?'));
  assert.equal(new URL(data.imageUrl,'https://marketplace.test').searchParams.get('source'),`https://ipfs.io/ipfs/${cid}/image.png`);
 }finally{globalThis.fetch=original;}
});
