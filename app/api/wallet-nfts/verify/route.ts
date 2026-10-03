import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, getAddress, http } from "viem";
import { env } from "@runtime-env";
import { getMarketplaceChain, tokenUrl } from "@/lib/marketplace-chains";
import { directIpfsImageUrl, nftMedia } from "@/lib/nft-media";
import { arcAnimation, arcImage, getArcNft } from "@/lib/opensea-nft";

export const dynamic = "force-dynamic";

const ownerOfAbi = [{ type: "function", name: "ownerOf", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ name: "owner", type: "address" }] }] as const;
const balanceOfAbi = [{ type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "tokenId", type: "uint256" }], outputs: [{ name: "balance", type: "uint256" }] }] as const;

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tokenId = params.get("tokenId");
  if (!tokenId || !/^\d+$/.test(tokenId) || tokenId.length > 78) return NextResponse.json({ error: "Enter a valid token ID." }, { status: 400 });
  let owner: `0x${string}`, contract: `0x${string}`;
  try {
    owner = getAddress(params.get("owner") ?? "");
    contract = getAddress(params.get("contract") ?? "");
  } catch {
    return NextResponse.json({ error: "Enter a valid wallet and NFT contract address." }, { status: 400 });
  }
  const chainId = 5042;
  const chain = getMarketplaceChain(chainId);
  const runtime = env as unknown as Record<string, string | undefined>;
  const client = createPublicClient({ transport: http(runtime.ARC_RPC_URL ?? chain.rpcUrl, { timeout: 10_000 }) });
  let tokenType = "ERC-721", quantity = "1";
  try {
    const currentOwner = await client.readContract({ address: contract, abi: ownerOfAbi, functionName: "ownerOf", args: [BigInt(tokenId)] });
    if (currentOwner.toLowerCase() !== owner.toLowerCase()) return NextResponse.json({ error: "This NFT is not in the connected wallet." }, { status: 404 });
  } catch {
    try {
      const balance = await client.readContract({ address: contract, abi: balanceOfAbi, functionName: "balanceOf", args: [owner, BigInt(tokenId)] });
      if (balance === 0n) return NextResponse.json({ error: "This NFT is not in the connected wallet." }, { status: 404 });
      tokenType = "ERC-1155";
      quantity = balance.toString();
    } catch {
      return NextResponse.json({ error: "Could not verify this NFT on Arc. Check the contract and token ID." }, { status: 502 });
    }
  }

  let name: string | null = null, collection: string | null = null, imageUrl: string | null = null, videoUrl: string | null = null;
  if (runtime.OPENSEA_API_KEY) {
    try {
      const item = await getArcNft(contract, tokenId, runtime.OPENSEA_API_KEY);
      const media = nftMedia(arcImage(item), arcAnimation(item));
      name = item.name ?? null;
      collection = item.collection ?? null;
      videoUrl = media.videoUrl;
      imageUrl = directIpfsImageUrl(media.imageUrl) ?? media.imageUrl;
    } catch { /* Ownership is already verified; artwork may be fetched separately. */ }
  }
  imageUrl ??= `/api/nft-image?${new URLSearchParams({ chainId: String(chainId), contract, tokenId })}`;
  return NextResponse.json({
    nft: { contractAddress: contract, tokenId, tokenType, quantity, name, collection, imageUrl, videoUrl,
      description: null, externalUrl: null, explorerUrl: tokenUrl(chainId, contract, tokenId), chainId, traits: [] },
  }, { headers: { "Cache-Control": "private, no-store" } });
}
