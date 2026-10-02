import { getAddress } from "viem";
import { getMarketplaceChain, isMarketplaceChainId, type MarketplaceChainId } from "@/lib/marketplace-chains";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.NOTIFICATION_WEBHOOK_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const {
      chainId,
      contract,
      tokenId,
      eventType,
      seller,
      buyer,
      price,
      transactionHash
    } = await request.json() as {
      chainId?: number;
      contract?: string;
      tokenId?: string;
      eventType?: string;
      seller?: string;
      buyer?: string;
      price?: string;
      transactionHash?: string;
    };

    // Validate required fields
    if (!chainId || !contract || !tokenId || !eventType) {
      return Response.json({ error: "Missing required fields: chainId, contract, tokenId, eventType" }, { status: 400 });
    }

    // Ensure tokenId is a string
    const validTokenId = String(tokenId);

    if (!isMarketplaceChainId(Number(chainId))) {
      return Response.json({ error: "Unsupported chain" }, { status: 400 });
    }

    const validContract = getAddress(contract);
    const chain = getMarketplaceChain(Number(chainId) as MarketplaceChainId);

    // Handle different event types
    if (eventType === "sold" || eventType === "offer_accepted") {
      if (!seller) {
        return Response.json({ error: "Seller address is required for this event type" }, { status: 400 });
      }
      
      // Get seller's notification settings
      const sellerSettings = await getNotificationSettings(seller, request.url);
      
      if (sellerSettings.emailEnabled && sellerSettings.email && sellerSettings.salesEnabled) {
        // Get NFT metadata
        const nftData = await getNftMetadata(validContract, validTokenId, Number(chainId), request.url);
        
        // Send sale notification
        await fetch(new URL('/api/notifications/send-sale', request.url), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
          body: JSON.stringify({
            email: sellerSettings.email,
            nftName: nftData?.name || `Token #${validTokenId}`,
            collectionName: nftData?.collection || null,
            price: price || "0",
            currency: chain.currency,
            buyer: buyer || null,
            transactionUrl: `${chain.explorerUrl}/tx/${transactionHash}`
          })
        });
      }
    }

    if (eventType === "offer_received" && seller) {
      if (!validTokenId) {
        return Response.json({ error: "Token ID is required for offer events" }, { status: 400 });
      }
      
      const sellerSettings = await getNotificationSettings(seller, request.url);
      
      if (sellerSettings.emailEnabled && sellerSettings.email && sellerSettings.offersEnabled) {
        const nftData = await getNftMetadata(validContract, validTokenId, Number(chainId), request.url);
        
        await fetch(new URL('/api/notifications/send-offer', request.url), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
          body: JSON.stringify({
            email: sellerSettings.email,
            nftName: nftData?.name || `Token #${validTokenId}`,
            collectionName: nftData?.collection || null,
            offerPrice: price || "0",
            currency: chain.currency,
            offerer: buyer || null,
            transactionUrl: `${chain.explorerUrl}/tx/${transactionHash}`
          })
        });
      }
    }

    return Response.json({ success: true, message: "Webhook processed successfully" });

  } catch (error) {
    console.error("Failed to process webhook:", error);
    return Response.json({ error: "Failed to process webhook" }, { status: 500 });
  }
}

async function getNotificationSettings(walletAddress: string, requestUrl: string) {
  try {
    const response = await fetch(new URL(`/api/notifications/settings?wallet=${walletAddress}`, requestUrl));
    if (response.ok) {
      return await response.json() as {
        email: string;
        emailEnabled: boolean;
        salesEnabled: boolean;
        offersEnabled: boolean;
      };
    }
    return { email: "", emailEnabled: false, salesEnabled: true, offersEnabled: true };
  } catch {
    return { email: "", emailEnabled: false, salesEnabled: true, offersEnabled: true };
  }
}

async function getNftMetadata(contract: string, tokenId: string, chainId: number, requestUrl: string) {
  try {
    const response = await fetch(new URL(`/api/nft?contract=${contract}&tokenId=${encodeURIComponent(tokenId)}&chainId=${chainId}`, requestUrl), { cache: "no-store" });
    if (response.ok) {
      return await response.json() as {
        name?: string;
        collection?: string;
        imageUrl?: string;
      } | null;
    }
    return null;
  } catch {
    return null;
  }
}
