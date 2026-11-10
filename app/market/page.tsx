import { Portal } from "../portal";
import { CombinedMarket } from "./combined-market";

export default async function MarketPage({ searchParams }: { searchParams: Promise<{ chainId?: string; cart?: string }> }) {
  const { chainId, cart } = await searchParams;
  return cart === "1" ? <Portal view="market"/> : <CombinedMarket initialChain={Number(chainId)}/>;
}
