import { InfoPage } from "../info-page";

export default function LearnPage() {
  return <InfoPage eyebrow="LEARN" title="How to use the marketplace" intro="From finding a listing to managing sales, approvals, and older contracts." sections={[
    { heading: "1. Connect and choose a network", body: "Connect Wallet, then select a live network. Your wallet should be on that same chain before you sign. Trading, balances, listings, and proceeds are separate on each network." },
    { heading: "2. Explore and buy", body: "Use Discover, Collections, Search, or Market. Open the NFT and check its chain, collection contract, token ID, price, and seller. Confirm the purchase and gas cost in your wallet. Cart checkout can combine supported purchases on one chain." },
    { heading: "3. List one ERC-721", body: "Open Profile, choose an NFT from your connected wallet, then open its NFT page and set a price. If the marketplace has no collection approval, approve it once. Then sign the listing transaction. The NFT stays in your wallet until sold." },
    { heading: "4. List several from one collection", body: "From Profile, open Bulk list your NFTs. On a network with marketplace V8, select 2 to 20 ERC-721 NFTs from the same collection in the collection listing panel. They share one price and one batch listing transaction. A first collection approval is a separate transaction; it covers that collection for that marketplace contract." },
    { heading: "5. List ERC-1155 editions", body: "Open an ERC-1155 NFT page, choose the quantity and price per edition, then confirm the approval and listing steps shown there. The ERC-721 bulk listing panel does not list editions." },
    { heading: "6. Manage listings and proceeds", body: "Open Profile for your listings and Withdraw for available sale proceeds. Cancel a listing you no longer want to sell. You can revoke collection approval from the collection listing panel under Bulk list your NFTs, but doing so makes active listings in that collection unbuyable until you approve again." },
    { heading: "7. Check earlier marketplace activity", body: "When a chain moves from V7 to V8, old listings, offers, and proceeds stay on V7. Use Earlier marketplace to buy or cancel those listings and access old account funds. Moving an NFT to V8 requires listing it again.", href: "/legacy" },
    { heading: "8. Read indexing status", body: "Listings and sales are read from blockchain events. A warning means the visible set may be incomplete until indexing catches up or the provider recovers. Check the transaction on the chain explorer if you need confirmation immediately." },
  ]} />;
}
