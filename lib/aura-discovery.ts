export const siteOrigin = "https://aura.thehouseofjoshi.com";
export const siteName = "Aura by Joshi";
export const supportEmail = "support@thehouseofjoshi.com";
export const siteDescription = "Aura by Joshi is a non-custodial NFT marketplace for discovering collections and trading NFTs across supported blockchain networks.";
export const siteUrl = (path: string) => new URL(path, siteOrigin).href;

export const publicPages = [
  ["/", "Discover", "Browse NFTs currently listed for sale by network."],
  ["/market", "Market", "Browse and filter marketplace listings."],
  ["/collections", "Collections", "Explore verified collections and listed NFTs."],
  ["/drops", "Drops", "Find featured releases, including Joshi Astrals."],
  ["/search", "Search", "Find NFTs by name, collection, contract, or token ID."],
  ["/activity", "Activity", "See marketplace listing and sale activity."],
  ["/rankings", "Rankings", "Explore marketplace rankings."],
  ["/stats", "Statistics", "View marketplace statistics."],
  ["/legacy", "Earlier listings", "Browse listings on earlier marketplace contracts."],
  ["/arc", "Arc", "Explore the Arc marketplace."],
  ["/base", "Base", "Explore the Base marketplace."],
  ["/cronos", "Cronos", "Explore the Cronos marketplace."],
  ["/polygon", "Polygon", "Explore the Polygon marketplace."],
  ["/shibarium", "Shibarium", "Explore the Shibarium marketplace."],
  ["/zora", "Zora", "Explore the Zora marketplace."],
  ["/apechain", "ApeChain", "View ApeChain marketplace information."],
  ["/about", "About", "Learn about the marketplace."],
  ["/community", "Community", "Find community resources."],
  ["/contact", "Contact", "Get in touch with marketplace support."],
  ["/faq", "FAQ", "Read answers to common marketplace questions."],
  ["/help-centre", "Help Centre", "Find marketplace guides and assistance."],
  ["/learn", "Learn", "Explore learning resources for collectors."],
  ["/protocol", "Protocol", "Learn how the marketplace works."],
  ["/resources", "Resources", "Find marketplace resources and related projects."],
  ["/support", "Support", "Get help with marketplace questions."],
  ["/tokens", "Tokens", "View token and network resources."],
  ["/privacy", "Privacy", "Read the privacy policy."],
  ["/terms", "Terms", "Read the marketplace terms."],
] as const;

const profiles = [
  "https://x.com/thehouseofjoshi",
  "https://www.instagram.com/thehouseofjoshi",
];

const organization = siteUrl("/#organization");
const website = siteUrl("/#website");

export const homeStructuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": organization,
      name: "The House of Joshi",
      alternateName: siteName,
      url: siteOrigin,
      logo: siteUrl("/aura-mark.svg"),
      description: siteDescription,
      sameAs: profiles,
      email: supportEmail,
      contactPoint: { "@type": "ContactPoint", contactType: "customer support", email: supportEmail, url: siteUrl("/contact") },
    },
    {
      "@type": "WebSite", "@id": website, url: siteUrl("/"),
      name: siteName, alternateName: "AURA", description: siteDescription,
      publisher: { "@id": organization }, inLanguage: "en",
    },
    {
      "@type": "CollectionPage", "@id": siteUrl("/#webpage"), url: siteUrl("/"),
      name: "Discover NFTs on Aura by Joshi", description: siteDescription,
      isPartOf: { "@id": website }, about: { "@id": organization }, inLanguage: "en",
      mainEntity: {
        "@type": "ItemList",
        itemListElement: publicPages.slice(1, 5).map(([path, name], index) => ({
          "@type": "ListItem", position: index + 1, name, url: siteUrl(path),
        })),
      },
    },
  ],
};

const links = (pages: ReadonlyArray<(typeof publicPages)[number]>) =>
  pages.map(([path, title, description]) => `- [${title}](${siteUrl(path)}): ${description}`).join("\n");

const supportIndex = publicPages.findIndex(([path]) => path === "/about");

export const llmsText = `# ${siteName}

> ${siteDescription}

## Marketplace

${links(publicPages.slice(0, supportIndex))}

## About and support

${links(publicPages.slice(supportIndex))}

## Agent access

- [Sitemap](${siteUrl("/sitemap.xml")})
- [MCP server card](${siteUrl("/.well-known/mcp/server-card.json")})
- [Support email](mailto:${supportEmail})
`;

export const homeMarkdown = `# Discover NFTs on ${siteName}

${siteDescription}

Browse NFTs currently listed for sale by network and review item details before trading from your wallet. Prices and availability can change. Check the item's current listing on the marketplace.

## Start exploring

${links(publicPages.slice(1, 8))}

## Help

Contact [marketplace support](mailto:${supportEmail}) or visit the [Help Centre](${siteUrl("/help-centre")}).

More links: [llms.txt](${siteUrl("/llms.txt")}) and [sitemap](${siteUrl("/sitemap.xml")}).
`;

export function prefersMarkdown(accept: string | null) {
  const quality = new Map<string, number>();
  for (const entry of (accept ?? "").split(",")) {
    const [type, ...parameters] = entry.toLowerCase().split(";").map(part => part.trim());
    const q = parameters.find(part => part.startsWith("q="));
    const value = q ? Number(q.slice(2)) : 1;
    if (Number.isFinite(value) && value >= 0 && value <= 1) quality.set(type, Math.max(quality.get(type) ?? 0, value));
  }
  const markdown = quality.get("text/markdown") ?? 0;
  const html = quality.get("text/html") ?? quality.get("text/*") ?? quality.get("*/*") ?? 0;
  return markdown > 0 && markdown >= html;
}
