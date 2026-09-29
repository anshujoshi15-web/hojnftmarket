export const SHIB_MAGAZINE_CONTRACT = "0x007bbf85988caf18cf4222c9214e4fa019b3e002";

type Cover = { edition: number; imageUrl: string; articleUrl: string };

// The publisher's token metadata bucket denies public reads for these older
// editions. These are the matching covers published on magazine.shib.io; both
// images have their edition number printed on the artwork.
const verifiedOlderCovers: Record<number, Cover> = {
  25: { edition: 25, imageUrl: "https://magazine.shib.io/wp-content/uploads/2025/04/Qma4AJSAeEjipztE3FRigQGXpkF5LP6HQShV8xagsyc744-1163x1536.png", articleUrl: "https://magazine.shib.io/a-bold-new-shib/" },
  26: { edition: 26, imageUrl: "https://magazine.shib.io/wp-content/uploads/2025/04/Qmbm3RhEzzfBYj6PbUFKCcumpiXyyZwN42JfdwXCVekM2P-1163x1536.png", articleUrl: "https://magazine.shib.io/shib-eyes-wall-street/" },
};

export function shibMagazineEdition(chainId: number, contract: string, tokenId: string) {
  if (chainId !== 109 || contract.toLowerCase() !== SHIB_MAGAZINE_CONTRACT || !/^\d+$/.test(tokenId)) return null;
  // The magazine mints up to 3,000 serials per edition; e.g. #330923 is edition 33.
  const id = BigInt(tokenId);
  const edition = id / 10_000n;
  if (edition > 1_000n || id % 10_000n >= 3_000n) return null;
  return Number(edition === 0n ? 1n : edition);
}

export function parseShibMagazineCovers(html: string): Cover[] {
  const covers = new Map<number, Cover>();
  for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
    const srcset = match[0].match(/\bsrcset=["']([^"']+)["']/i)?.[1] ?? "";
    const original = srcset.split(",").map(entry => entry.trim().split(/\s+/)[0]).find(url => /\/(?:cover[-_]\d{1,3}(?:[-_]\d+)?|\d{1,3}[-_]cover\d*(?:[-_]\d+)?)\.[a-z]+$/i.test(url));
    const source = original ?? match[0].match(/\bsrc=["']([^"']+)["']/i)?.[1];
    if (!source) continue;
    try {
      const image = new URL(source, "https://magazine.shib.io");
      if (image.origin !== "https://magazine.shib.io" || !image.pathname.startsWith("/wp-content/uploads/")) continue;
      const filename = image.pathname.split("/").pop() ?? "";
      const numbered = filename.match(/^(?:cover[-_](\d{1,3})(?:[-_.]|$)|(\d{1,3})[-_]cover\d*(?:[-_.]|$))/i);
      const edition = Number(numbered?.[1] ?? numbered?.[2]);
      if (!numbered || edition < 1 || edition > 1000 || covers.has(edition)) continue;
      covers.set(edition, { edition, imageUrl: image.href, articleUrl: "https://magazine.shib.io/magazine-editions/" });
    } catch {
      // Ignore malformed media links on the publisher page.
    }
  }
  return [...covers.values()];
}

export async function officialShibMagazineCover(edition: number, refresh = false) {
  if (verifiedOlderCovers[edition]) return verifiedOlderCovers[edition];
  const response = await fetch("https://magazine.shib.io/magazine-editions/", {
    headers: { accept: "text/html" },
    signal: AbortSignal.timeout(12_000),
    ...(refresh ? { cache: "no-store" as const } : { next: { revalidate: 60 * 60 * 6 } }),
  });
  if (!response.ok) throw new Error(`Magazine covers returned ${response.status}`);
  const cover = parseShibMagazineCovers(await response.text()).find(item => item.edition === edition);
  if (!cover) throw new Error("Edition cover was not found on the official magazine site");
  return cover;
}
