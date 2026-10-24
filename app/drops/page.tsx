import Link from "next/link";
import AstralsMint from "./astrals-mint";

const astralsContract = "0x402f4ead8909145a57a45eeb27446111e6738c48";

export default function DropsPage() {
  return <main className="drops-page">
    <section className="drops-hero">
      <span>DROPS</span>
      <h1>Drops</h1>
      <p>Explore House of Joshi releases and visit each collection’s mint site.</p>
    </section>
    <section className="featured-drop" aria-labelledby="joshi-astrals-title">
      <div className="featured-drop-copy">
        <span>FEATURED COLLECTION · ARC</span>
        <h2 id="joshi-astrals-title">Joshi Astrals</h2>
        <p>Discover Joshi Astrals on Arc. Visit the collection’s website for mint details or explore it on OpenSea.</p>
        <dl>
          <div><dt>NETWORK</dt><dd>Arc</dd></div>
          <div><dt>PLANNED PUBLIC MINT</dt><dd>25 October 2026</dd></div>
          <div><dt>PUBLIC SUPPLY</dt><dd>7,577 NFTs after the 200-NFT House allocation</dd></div>
          <div><dt>PLANNED WALLET LIMIT</dt><dd>Two public mints per wallet · No buyer whitelist</dd></div>
          <div><dt>CONTRACT</dt><dd><a href={`https://explorer.arc.io/address/${astralsContract}`} target="_blank" rel="noopener noreferrer">{astralsContract}</a></dd></div>
        </dl>
        <p>Final availability is controlled by the official OpenSea Drop. Network gas is additional. Resale creator earnings are initially set to 7%, subject to marketplace rules.</p>
        <p>After minting, connect the wallet that holds your NFT to Astral Studio to create a wallpaper, banner or profile picture.</p>
        <div className="astrals-drop-links">
          <a className="royal-view-all" href="https://joshiastrals.thehouseofjoshi.com/" target="_blank" rel="noopener noreferrer">Visit mint site ↗</a>
          <a className="royal-view-all" href="https://opensea.io/collection/joshi-astrals" target="_blank" rel="noopener noreferrer">View on OpenSea ↗</a>
          <Link className="royal-view-all" href={`/collection/5042/${astralsContract}`}>Explore collection →</Link>
        </div>
      </div>
      <AstralsMint />
    </section>
  </main>;
}
