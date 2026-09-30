import { erc721Abi, erc1155Abi, type Address, type PublicClient } from "viem";
import { marketplaceAbi } from "./marketplace-abi";

export async function readErc721Owner(client:PublicClient,nft:Address,token:bigint):Promise<Address>{
  try{return await client.readContract({address:nft,abi:erc721Abi,functionName:"ownerOf",args:[token]});}
  catch{
    const edition=await client.readContract({address:nft,abi:erc1155Abi,functionName:"supportsInterface",args:["0xd9b67a26"]}).catch(()=>false);
    if(edition)throw new Error("This NFT is an ERC-1155 edition. Open its NFT page to list a quantity.");
    throw new Error(`Ownership could not be verified for token #${token}. Check that the NFT contract, token ID, and network are correct, then try again.`);
  }
}

export async function inspectListing(client:PublicClient,market:Address,nft:Address,token:bigint,account:Address){
  const owner=await readErc721Owner(client,nft,token);
  const [listing,all]=await Promise.all([
    client.readContract({address:market,abi:marketplaceAbi,functionName:"getListing",args:[nft,token]}),
    client.readContract({address:nft,abi:erc721Abi,functionName:"isApprovedForAll",args:[account,market]}),
  ]);
  if(owner.toLowerCase()!==account.toLowerCase())throw new Error("Only the current owner can list this NFT.");
  if(listing.price>0n){
    if(listing.seller.toLowerCase()===account.toLowerCase())throw new Error("This NFT already has a listing. Cancel it before changing the price.");
    const version=await client.readContract({address:market,abi:marketplaceAbi,functionName:"marketplaceVersion"}).catch(()=>0n);
    if(version<3n)throw new Error("This older marketplace has a stale listing from the previous owner. The previous seller must cancel it, or this network must move to the updated marketplace.");
  }
  if(all)return {needsApproval:false};
  const approved=await client.readContract({address:nft,abi:erc721Abi,functionName:"getApproved",args:[token]});
  return {needsApproval:approved.toLowerCase()!==market.toLowerCase()};
}
