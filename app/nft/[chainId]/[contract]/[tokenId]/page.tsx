import { NftPage } from "../../../../nft-page";
import { redirect } from "next/navigation";

export default async function Page({params,searchParams}:{params:Promise<{chainId:string;contract:string;tokenId:string}>;searchParams:Promise<{from?:string;legacy?:string}>}){
  const value=await params;
  const query=await searchParams;
  if(query.legacy==="1")redirect(`/nft/${value.chainId}/${value.contract}/${value.tokenId}`);
  return <NftPage chainId={Number(value.chainId)} contract={value.contract} tokenId={value.tokenId} returnTo={query.from==="profile"?"/profile":"/market"}/>;
}
