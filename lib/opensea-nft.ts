export type OpenSeaNft = {
  identifier: string;
  contract: string;
  token_standard?: string | null;
  name?: string | null;
  collection?: string | null;
  description?: string | null;
  image_url?: string | null;
  display_image_url?: string | null;
  original_image_url?: string | null;
  animation_url?: string | null;
  display_animation_url?: string | null;
  original_animation_url?: string | null;
  opensea_url?: string | null;
  is_disabled?: boolean;
  is_nsfw?: boolean;
  traits?: Array<{ trait_type?: string | null; value?: string | number | boolean | null }>;
};

async function requestOpenSea(path: string, apiKey: string): Promise<unknown> {
  const response = await fetch(`https://api.opensea.io/api/v2/chain/arc/${path}`, {
    headers: { accept: "application/json", "x-api-key": apiKey },
    signal: AbortSignal.timeout(12_000),
    next: { revalidate: 60 },
  });
  if (!response.ok) throw new Error(`OpenSea NFT API returned ${response.status}`);
  return response.json();
}

export async function getArcNft(contract: string, tokenId: string, apiKey: string): Promise<OpenSeaNft> {
  const payload = await requestOpenSea(`contract/${contract}/nfts/${tokenId}`, apiKey) as { nft?: OpenSeaNft };
  if (!payload.nft || payload.nft.contract.toLowerCase() !== contract.toLowerCase() || payload.nft.identifier !== tokenId) {
    throw new Error("OpenSea returned a different NFT");
  }
  return payload.nft;
}

export async function getArcWalletNfts(owner: string, apiKey: string) {
  const nfts: OpenSeaNft[] = [];
  let next: string | null = null;
  for (let page = 0; page < 5; page++) {
    const params = new URLSearchParams({ limit: "200", include_auto_hidden: "true" });
    if (next) params.set("next", next);
    const payload = await requestOpenSea(`account/${owner}/nfts?${params}`, apiKey) as { nfts?: OpenSeaNft[]; next?: string | null };
    if (!Array.isArray(payload.nfts)) throw new Error("OpenSea returned an invalid wallet page");
    nfts.push(...payload.nfts);
    next = payload.next ?? null;
    if (!next) return { nfts, complete: true };
  }
  return { nfts, complete: false };
}

export function arcImage(nft: OpenSeaNft) {
  // OpenSea's original IPFS URL can be extensionless even when it is an MP4.
  // Its processed URL retains the media extension needed by nftMedia().
  return nft.image_url ?? nft.display_image_url ?? nft.original_image_url ?? null;
}

export function arcAnimation(nft: OpenSeaNft) {
  return nft.original_animation_url ?? nft.animation_url ?? nft.display_animation_url ?? null;
}
