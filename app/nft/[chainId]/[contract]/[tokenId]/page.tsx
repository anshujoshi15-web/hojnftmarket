import { NftPage } from "../../../../nft-page";

export default async function Page({params,searchParams}:{params:Promise<{chainId:string;contract:string;tokenId:string}>;searchParams:Promise<{from?:string;legacy?:string}>}){
  const value=await params;
  const query=await searchParams;
  return <NftPage key={`${value.chainId}:${value.contract}:${value.tokenId}:${query.legacy??"0"}`} chainId={Number(value.chainId)} contract={value.contract} tokenId={value.tokenId} legacy={query.legacy==="1"} returnTo={query.from==="profile"?"/profile":"/market"}/>;
}
