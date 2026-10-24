import { createPublicClient, http, keccak256, parseAbi, zeroAddress, type Address } from "viem";

export const astralsAddress = "0x402f4ead8909145a57a45eeb27446111e6738c48" as const;
export const seaDropAddress = "0x00005EA00Ac477B1030CE78506496e8C2dE24bf5" as const;
export const seaDropAbi = parseAbi([
  "function getPublicDrop(address) view returns ((uint80 mintPrice,uint48 startTime,uint48 endTime,uint16 maxTotalMintableByWallet,uint16 feeBps,bool restrictFeeRecipients))",
  "function getAllowedFeeRecipients(address) view returns (address[])",
  "function getCreatorPayoutAddress(address) view returns (address)",
  "function mintPublic(address nftContract,address feeRecipient,address minterIfNotPayer,uint256 quantity) payable",
]);
const nftAbi = parseAbi([
  "function name() view returns (string)",
  "function getMintStats(address) view returns (uint256 minterNumMinted,uint256 currentTotalSupply,uint256 maxSupply)",
]);
const client = createPublicClient({ transport: http("https://rpc.mainnet.arc.io", { timeout: 12000 }) });

export async function readAstralsMint(wallet: Address = zeroAddress) {
  const block = await client.getBlock();
  const blockNumber = block.number;
  const [seaCode,nftCode,name,drop,payout,recipients,stats] = await Promise.all([
    client.getCode({address:seaDropAddress,blockNumber}),
    client.getCode({address:astralsAddress,blockNumber}),
    client.readContract({address:astralsAddress,abi:nftAbi,functionName:"name",blockNumber}),
    client.readContract({address:seaDropAddress,abi:seaDropAbi,functionName:"getPublicDrop",args:[astralsAddress],blockNumber}),
    client.readContract({address:seaDropAddress,abi:seaDropAbi,functionName:"getCreatorPayoutAddress",args:[astralsAddress],blockNumber}),
    client.readContract({address:seaDropAddress,abi:seaDropAbi,functionName:"getAllowedFeeRecipients",args:[astralsAddress],blockNumber}),
    client.readContract({address:astralsAddress,abi:nftAbi,functionName:"getMintStats",args:[wallet],blockNumber}),
  ]);
  if(!seaCode || !nftCode || keccak256(seaCode)!=="0x49ac1def6aee7ea8fcafc434b9c4c723caa850027a143fa0f9d5be02275b5539" || keccak256(nftCode)!=="0x91c55594edf43ce950a4cc6ceca98db754b0c680897f7498021b29f9d3b057a6" || name!=="Joshi Astrals") throw Error("Official collection verification failed.");
  return {drop,payout,recipients,stats,timestamp:block.timestamp};
}

export function astralsMintQuote(data: Awaited<ReturnType<typeof readAstralsMint>>, quantity: number) {
  const {drop,payout,recipients,stats,timestamp}=data;
  if(!Number.isSafeInteger(quantity)||quantity<1)throw Error("Choose a positive whole number of Astrals.");
  if(!drop.startTime||!drop.endTime||!drop.maxTotalMintableByWallet)throw Error("Public mint has not been configured yet.");
  if(timestamp<BigInt(drop.startTime))throw Error(`Mint opens ${new Date(Number(drop.startTime)*1000).toLocaleString(undefined,{timeZoneName:"short"})}.`);
  if(timestamp>BigInt(drop.endTime))throw Error("Public mint has ended.");
  if(drop.mintPrice!==25n*10n**18n||stats[2]!==7777n||stats[1]<200n||stats[1]>stats[2])throw Error("Live mint settings need review. Please check the official mint site.");
  if(payout===zeroAddress||recipients.length!==1||recipients[0]===zeroAddress)throw Error("Mint payout settings need review.");
  if(stats[1]===stats[2])throw Error("All Astrals have been minted.");
  if(stats[0]+BigInt(quantity)>BigInt(drop.maxTotalMintableByWallet))throw Error("This quantity exceeds your remaining onchain mint allowance.");
  if(stats[1]+BigInt(quantity)>stats[2])throw Error("Not enough Astrals remain for this quantity.");
  return {value:drop.mintPrice*BigInt(quantity),feeRecipient:recipients[0]};
}
