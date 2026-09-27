import {createPublicClient,getAddress,http} from "viem";
import {mainnet,base,polygon,cronos,zora,apeChain} from "viem/chains";

const custom={109:{id:109,name:"Shibarium",rpc:"https://rpc.shibarium.shib.io"},4663:{id:4663,name:"Robinhood",rpc:"https://rpc.mainnet.chain.robinhood.com"},5042:{id:5042,name:"Arc",rpc:"https://rpc.mainnet.arc.io"}};
const chains=new Map([mainnet,base,polygon,cronos,zora,apeChain].map(chain=>[chain.id,{id:chain.id,name:chain.name,rpc:chain.rpcUrls.default.http[0]}]));
for(const chain of Object.values(custom))chains.set(chain.id,chain);
const chain=chains.get(Number(process.env.CHECK_CHAIN_ID));
const address=process.env.CHECK_MARKETPLACE_ADDRESS;
const treasury=process.env.CHECK_TREASURY_ADDRESS;
if(!chain||!address||!treasury)throw new Error("Set CHECK_CHAIN_ID, CHECK_MARKETPLACE_ADDRESS, and CHECK_TREASURY_ADDRESS.");
const market=getAddress(address),expectedTreasury=getAddress(treasury);
const client=createPublicClient({transport:http(process.env.CHECK_RPC_URL??chain.rpc,{timeout:15_000})});
const abi=[
  {type:"function",name:"marketplaceVersion",stateMutability:"pure",inputs:[],outputs:[{type:"uint256"}]},
  {type:"function",name:"HOUSE_TREASURY",stateMutability:"view",inputs:[],outputs:[{type:"address"}]},
  {type:"function",name:"MARKETPLACE_FEE_BPS",stateMutability:"view",inputs:[],outputs:[{type:"uint256"}]},
  {type:"function",name:"batchList",stateMutability:"nonpayable",inputs:[{type:"address"},{type:"uint256[]"},{type:"uint256[]"}],outputs:[]},
];
const [networkId,code,version,actualTreasury,fee]=await Promise.all([
  client.getChainId(),client.getBytecode({address:market}),
  client.readContract({address:market,abi,functionName:"marketplaceVersion"}),
  client.readContract({address:market,abi,functionName:"HOUSE_TREASURY"}),
  client.readContract({address:market,abi,functionName:"MARKETPLACE_FEE_BPS"}),
]);
const valid=networkId===chain.id&&!!code&&code!=="0x"&&version===8n&&fee===200n&&actualTreasury.toLowerCase()===expectedTreasury.toLowerCase();
console.log(JSON.stringify({valid,chain:chain.name,chainId:networkId,address:market,version:String(version),treasury:actualTreasury,feeBps:String(fee),hasCode:!!code&&code!=="0x"},null,2));
if(!valid)process.exitCode=1;
