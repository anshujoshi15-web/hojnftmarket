export const SHIB_MAGAZINE_CONTRACT = "0x007bbf85988caf18cf4222c9214e4fa019b3e002";

type Cover = { edition: number; imageUrl: string; articleUrl: string };
type PublisherMedia = { title?: { rendered?: string }; source_url?: string };
const EDITIONS_URL = "https://magazine.shib.io/magazine-editions/";

function publisherImage(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.origin === "https://magazine.shib.io" && url.pathname.startsWith("/wp-content/uploads/") && /\.(?:png|jpe?g|webp)$/i.test(url.pathname) ? url.href : null;
  } catch { return null; }
}

// The publisher's token metadata bucket denies public reads for these older
// editions. These are the matching covers published on magazine.shib.io; both
// images have their edition number printed on the artwork.
const verifiedOlderCovers: Record<number, Cover> = {
  25: { edition: 25, imageUrl: "https://magazine.shib.io/wp-content/uploads/2025/04/Qma4AJSAeEjipztE3FRigQGXpkF5LP6HQShV8xagsyc744-1163x1536.png", articleUrl: "https://magazine.shib.io/a-bold-new-shib/" },
  26: { edition: 26, imageUrl: "https://magazine.shib.io/wp-content/uploads/2025/04/Qmbm3RhEzzfBYj6PbUFKCcumpiXyyZwN42JfdwXCVekM2P-1163x1536.png", articleUrl: "https://magazine.shib.io/shib-eyes-wall-street/" },
};

export function shibMagazineEdition(chainId: number, contract: string, tokenId: string) {
  if (chainId !== 109 || contract.toLowerCase() !== SHIB_MAGAZINE_CONTRACT || !/^\d+$/.test(tokenId)) return null;
  // Token IDs reserve four decimal digits for the serial; real editions include
  // serials above 3,000 (for example #295774 is edition 29).
  const id = BigInt(tokenId);
  const edition = id / 10_000n;
  if (edition > 1_000n) return null;
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

// The publisher labels these media items "NFT Cover for ..." and uploaded
// consecutive issues in reverse order. Anchor the sequence to the two covers
// whose issue numbers were independently verified, so unrelated search hits or
// later uploads cannot shift the mapping.
export function parseShibMagazineMediaCovers(media: PublisherMedia[]): Cover[] {
  const covers = media.filter(item => /^NFT Cover for /i.test(item.title?.rendered ?? "") && publisherImage(item.source_url));
  const anchor = covers.findIndex(item => item.title?.rendered === "NFT Cover for A Bold New Shib");
  if (anchor < 1 || covers[anchor - 1].title?.rendered !== "NFT Cover for SHIB Eyes Wall Street") return [];
  return covers.flatMap((item, index) => {
    const edition = 25 + anchor - index;
    const imageUrl = publisherImage(item.source_url);
    return edition >= 1 && edition <= 75 && imageUrl ? [{ edition, imageUrl, articleUrl: EDITIONS_URL }] : [];
  });
}

async function publisherMedia(search: string, refresh: boolean): Promise<PublisherMedia[]> {
  const url = new URL("https://magazine.shib.io/wp-json/wp/v2/media");
  url.search = new URLSearchParams({ search, per_page: "100", orderby: "date", order: "desc" }).toString();
  const response = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(8_000),
    ...(refresh ? { cache: "no-store" as const } : { next: { revalidate: 60 * 60 * 6 } }),
  });
  if (!response.ok) throw new Error(`Publisher media returned ${response.status}`);
  return response.json() as Promise<PublisherMedia[]>;
}

let olderCatalog: { expires: number; promise: Promise<Cover[]> } | null = null;
async function olderMediaCovers(refresh: boolean) {
  if (refresh) return parseShibMagazineMediaCovers(await publisherMedia("NFT Cover", true));
  if (olderCatalog && olderCatalog.expires > Date.now()) return olderCatalog.promise;
  const promise = publisherMedia("NFT Cover", false).then(parseShibMagazineMediaCovers);
  olderCatalog = { expires: Date.now() + 6 * 60 * 60_000, promise };
  try { return await promise; }
  catch (error) { if (olderCatalog?.promise === promise) olderCatalog = null; throw error; }
}

async function numberedMediaCover(edition: number, refresh: boolean): Promise<Cover> {
  const searches = [`Cover-${edition}`, `${edition}-Cover`];
  const results = await Promise.allSettled(searches.map(search => publisherMedia(search, refresh)));
  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    for (const item of result.value) {
      const imageUrl = publisherImage(item.source_url);
      const filename = imageUrl?.split("/").pop() ?? "";
      if (new RegExp(`^(?:cover[-_]${edition}(?:[-_.]|$)|${edition}[-_]cover\\d*(?:[-_.]|$))`, "i").test(filename) && imageUrl)
        return { edition, imageUrl, articleUrl: EDITIONS_URL };
    }
  }
  throw new Error("Numbered edition cover was not found in the publisher media catalog");
}

const coverCache = new Map<number, { expires: number; promise: Promise<Cover> }>();
export async function officialShibMagazineCover(edition: number, refresh = false): Promise<Cover> {
  if (verifiedOlderCovers[edition]) return verifiedOlderCovers[edition];
  if (refresh) return resolveShibMagazineCover(edition, true);
  const cached = coverCache.get(edition);
  if (cached && cached.expires > Date.now()) return cached.promise;
  const promise = resolveShibMagazineCover(edition, false);
  coverCache.set(edition, { expires: Date.now() + 6 * 60 * 60_000, promise });
  try { return await promise; }
  catch (error) { if (coverCache.get(edition)?.promise === promise) coverCache.delete(edition); throw error; }
}

async function resolveShibMagazineCover(edition: number, refresh: boolean): Promise<Cover> {
  if (edition >= 1 && edition <= 75) {
    try {
      const cover = (await olderMediaCovers(refresh)).find(item => item.edition === edition);
      if (cover) return cover;
    } catch { /* The editions page may have a separately numbered cover. */ }
  } else {
    try { return await numberedMediaCover(edition, refresh); }
    catch { /* The editions page may have a numbered image absent from search. */ }
  }
  const response = await fetch(EDITIONS_URL, {
    headers: { accept: "text/html" },
    signal: AbortSignal.timeout(12_000),
    ...(refresh ? { cache: "no-store" as const } : { next: { revalidate: 60 * 60 * 6 } }),
  });
  if (!response.ok) throw new Error(`Magazine covers returned ${response.status}`);
  const cover = parseShibMagazineCovers(await response.text()).find(item => item.edition === edition);
  if (!cover) throw new Error("Edition cover was not found on the official magazine site");
  return cover;
}
