import { InfoPage } from "../info-page";
import { marketplaceChains, type MarketplaceChainId } from "../../lib/marketplace-chains";

const chains = (Object.keys(marketplaceChains).map(Number) as MarketplaceChainId[]).map(id => marketplaceChains[id]);
const live = chains.filter(chain => chain.marketplaceStatus === "live");
const pending = chains.filter(chain => chain.marketplaceStatus !== "live");

export default function FaqPage() {
  return <InfoPage eyebrow="FAQ" title="Frequently asked questions" intro="Practical answers about trading across the House of Joshi marketplace." sections={[
    { heading: "Which networks are live?", body: `${live.map(chain => chain.name).join(", ")} are live. ${pending.map(chain => chain.name).join(" and ")} are coming soon. Choose a live network before trading; each network has its own marketplace contract.` },
    { heading: "What currency do I need?", body: `Listings settle in the currency shown for their network: ${live.map(chain => `${chain.currency} on ${chain.name}`).join(", ")}. Keep enough of that network's gas currency for wallet transactions. Listings and proceeds stay on their original network.` },
    { heading: "How do I list an NFT?", body: "Connect your wallet, open Profile, choose an NFT you own, and open its NFT page. Enter a price and confirm any collection approval followed by the listing transaction. For ERC-1155 editions, set the quantity and price per edition on the NFT page." },
    { heading: "Can I list several NFTs with one gas fee?", body: "On Profile, tap the small checkbox on each NFT you want to sell. The bottom bar opens a price form for up to 20 ERC-721 NFTs from one collection. Set individual prices, review, then confirm. A first-time collection approval is a separate gas transaction; the batch listing uses one further transaction." },
    { heading: "Why did my wallet request two transactions?", body: "The first may be setApprovalForAll, which authorizes that marketplace contract to transfer NFTs from the collection. The second lists the NFT or batch. An existing approval for the same collection and marketplace avoids the approval transaction. A new marketplace contract needs its own approval. Review the wallet's final gas estimate before signing." },
    { heading: "Where are my older V7 listings and proceeds?", body: "When a network moves to V8, earlier V7 listings, offers, and proceeds remain on the V7 contract. Open older contract management to cancel those listings and withdraw proceeds. They do not move to V8 automatically; listing on V8 requires a separate approval.", href: "/legacy/account" },
    { heading: "Why are listings or sales missing?", body: "Discover and activity use blockchain indexing. If an indexing warning appears, events may be missing while scanning catches up or a network provider is unavailable. Check the selected network and its explorer. Onchain transaction records remain the source of truth." },
    { heading: "Does the marketplace hold my NFT?", body: "No. Your NFT stays in your wallet until a valid purchase. Revoking collection approval prevents existing listings in that collection from being bought until approval is restored." },
    { heading: "What are the fees?", body: "The marketplace contract charges 2% of a sale. ERC-2981 creator royalties may also apply. Network gas fees are separate, vary by chain and wallet, and are paid for onchain transactions even if no NFT is sold." },
  ]} />;
}
