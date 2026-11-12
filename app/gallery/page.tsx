import type { Metadata } from "next";
import SpotlightGallery from "./spotlight-gallery";

const title = "Artist Spotlight · AURA by Joshi";
const description = "Explore featured NFT artworks and collections in AURA’s 3D gallery.";
const shareImage = { url: "/aura-marketplace-share.png", width: 1200, height: 630, alt: "AURA Multichain NFT Marketplace" };

export const metadata: Metadata = {
  title,
  description,
  openGraph: { title, description, type: "website", images: [shareImage] },
  twitter: { card: "summary_large_image", title, description, images: [shareImage] },
};

export default function GalleryPage() {
  return <SpotlightGallery />;
}
