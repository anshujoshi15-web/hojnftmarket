import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

const featuredCollections = [
  {
    name: "Kingdom Within",
    href: "https://kingdomwithin.thehouseofjoshi.com/",
    image: "/discover/kingdom-within.png",
  },
  {
    name: "Agent X-84",
    href: "https://kaboom.thehouseofjoshi.com/",
    image: "/discover/agent-x-84.png",
  },
];

export default function AstralsDiscoverDrop() {
  return (
    <>
      <section className="astrals-discover-drop" aria-labelledby="astrals-discover-title">
        <div className="astrals-discover-art">
          <Image
            src="https://joshiastrals.thehouseofjoshi.com/branding/launch-hero.jpg"
            alt="A lavender stone companion framed by a golden celestial portal"
            fill
            priority
            sizes="(max-width: 700px) 100vw, 58vw"
          />
        </div>
        <div className="astrals-discover-copy">
          <h2 id="astrals-discover-title">Joshi Astrals</h2>
          <p>A celestial collection of fantasy companions carved in stone and guided by the stars.</p>
          <Link href="/drops" className="astrals-discover-action">View drop <ArrowRight size={21} aria-hidden="true" /></Link>
        </div>
      </section>
      <section className="discover-featured-collections" aria-labelledby="discover-collections-title">
        <h2 id="discover-collections-title">Featured collections</h2>
        <div className="discover-collection-grid">
          {featuredCollections.map(collection => (
            <a key={collection.name} href={collection.href} className="discover-collection-feature">
              <div className="discover-collection-feature-art">
                <Image src={collection.image} alt="" fill sizes="(max-width: 540px) 95vw, 48vw" />
              </div>
              <div className="discover-collection-feature-copy">
                <h3>{collection.name}</h3>
                <span>View collection <ArrowRight size={16} aria-hidden="true" /></span>
              </div>
            </a>
          ))}
        </div>
      </section>
    </>
  );
}
