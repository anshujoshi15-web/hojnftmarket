import { InfoPage } from "../info-page";

export default function AboutPage() {
  return <InfoPage eyebrow="ABOUT" title="The House of Joshi" intro="A multichain marketplace for collecting and presenting NFTs." sections={[
    { heading: "The marketplace", body: "The House of Joshi marketplace supports ERC-721 NFTs and ERC-1155 editions on its live networks. Each network uses its own contract and settlement currency; networks marked Coming soon cannot be traded here yet." },
    { heading: "Ownership and settlement", body: "Listings are non-custodial: the asset remains in its owner's wallet until a valid purchase. The marketplace contract records listings and settles sales onchain." },
    { heading: "Marketplace upgrades", body: "V8 adds same-collection ERC-721 bulk listing on supported networks. Each network has its own marketplace contract." },
    { heading: "The House ecosystem", body: "Explore HOJ Swap and NFT Launchpad through the marketplace navigation." },
  ]} />;
}
