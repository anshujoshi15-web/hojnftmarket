import { InfoPage } from "../info-page";

export default function LearnPage() {
  return <InfoPage eyebrow="LEARN" title="How to use the marketplace" intro="From finding a listing to managing sales and approvals." sections={[
    { heading: "1. Connect and choose a network", body: "Connect Wallet, then select a live network. Your wallet should be on that same chain before you sign. Trading, balances, listings, and proceeds are separate on each network." },
    { heading: "2. Explore and buy", body: "Use Discover, Collections, Search, or Market. Open the NFT and check its chain, collection contract, token ID, price, and seller. Confirm the purchase and gas cost in your wallet. Cart checkout can combine supported purchases on one chain." },
    { heading: "3. List one ERC-721", body: "Open Profile, choose an NFT from your connected wallet, then open its NFT page and set a price. If the marketplace has no collection approval, approve it once. Then sign the listing transaction. The NFT stays in your wallet until sold." },
    { heading: "4. List several from one collection", body: "On Profile, check up to 20 ERC-721 NFTs from one collection. Tap List in the bottom bar, enter a price for each NFT, review the total and fees, then confirm in your wallet. A first collection approval is a separate transaction; the batch listing is one further transaction." },
    { heading: "5. List ERC-1155 editions", body: "Open an ERC-1155 NFT page, choose the quantity and price per edition, then confirm the approval and listing steps shown there. The Profile bulk listing flow does not list editions." },
    { heading: "6. Manage listings and proceeds", body: "Open Profile for your listings and Withdraw for available sale proceeds. Cancel a listing you no longer want to sell. You can revoke collection approval from your wallet or the NFT contract, but doing so makes active listings in that collection unbuyable until you approve again." },
    { heading: "7. Read indexing status", body: "Listings and sales are read from blockchain events. A warning means the visible set may be incomplete until indexing catches up or the provider recovers. Check the transaction on the chain explorer if you need confirmation immediately." },
  ]} />;
}
