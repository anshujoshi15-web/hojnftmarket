import { NextResponse } from "next/server";
import { env } from "@runtime-env";
import { nftMedia } from "@/lib/nft-media";
import { arcAnimation, arcImage, type OpenSeaNft } from "@/lib/opensea-nft";

export const dynamic = "force-dynamic";

const ROTATION_SECONDS = 2 * 60 * 60;
type ArcCollection = { collection?: string; name?: string; contracts?: Array<{ address?: string; chain?: string }> };

async function openSea(path: string, apiKey: string) {
  const response = await fetch(`https://api.opensea.io/api/v2/${path}`, {
    headers: { accept: "application/json", "x-api-key": apiKey },
    signal: AbortSignal.timeout(10_000),
    next: { revalidate: ROTATION_SECONDS },
  });
  if (!response.ok) throw new Error(`Arc discovery provider returned ${response.status}`);
  return response.json();
}

export async function GET() {
  const apiKey = (env as unknown as Record<string, string | undefined>).OPENSEA_API_KEY;
  if (!apiKey) return NextResponse.json({ nfts: [], error: "Arc discovery is not configured." }, { status: 503 });
  const bucket = Math.floor(Date.now() / (ROTATION_SECONDS * 1000));
  try {
    const result = await openSea("collections/trending?chains=arc&limit=8&timeframe=seven_days", apiKey) as { collections?: ArcCollection[] };
    const collections = (result.collections ?? []).filter(item => item.collection && item.contracts?.some(contract => contract.chain === "arc" || !contract.chain));
    const pages = await Promise.allSettled(collections.slice(0, 8).map(async collection => {
      const result = await openSea(`collection/${encodeURIComponent(collection.collection!)}/nfts?limit=30`, apiKey) as { nfts?: OpenSeaNft[] };
      if (!Array.isArray(result.nfts)) return null;
      const candidates = result.nfts.filter(nft =>
        /^0x[0-9a-fA-F]{40}$/.test(nft.contract) && /^\d+$/.test(nft.identifier) &&
        !nft.is_disabled && !nft.is_nsfw && Boolean(arcImage(nft) || arcAnimation(nft)) &&
        collection.contracts?.some(contract => contract.address?.toLowerCase() === nft.contract.toLowerCase())
      );
      if (!candidates.length) return null;
      const offset = [...collection.collection!].reduce((sum, character) => sum + character.charCodeAt(0), 0);
      const index = (bucket + offset) % candidates.length;
      return { nft: candidates[index], collectionName: collection.name ?? collection.collection! };
    }));
    const nfts = pages.flatMap(result => result.status === "fulfilled" && result.value ? [result.value] : []).slice(0, 4).map(({ nft, collectionName }) => {
      const media = nftMedia(arcImage(nft), arcAnimation(nft));
      return {
        chainId: 5042,
        contract: nft.contract,
        tokenId: nft.identifier,
        name: nft.name ?? `Token #${nft.identifier}`,
        collection: collectionName,
        imageUrl: media.imageUrl,
        videoUrl: media.videoUrl,
      };
    });
    const remaining = ROTATION_SECONDS - Math.floor(Date.now() / 1000) % ROTATION_SECONDS;
    return NextResponse.json({ nfts, bucket }, { headers: { "Cache-Control": `public, s-maxage=${remaining}, stale-while-revalidate=60` } });
  } catch {
    return NextResponse.json({ nfts: [], error: "Arc discovery is temporarily unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
