import type { Metadata } from "next";
import SpotlightGallery from "./spotlight-gallery";

const title = "Artist Spotlight · AURA by Joshi";
const description = "Explore featured NFT artworks and collections in AURA’s 3D gallery.";
const shareImage = { url: "/aura-logo.webp", width: 320, height: 284, alt: "AURA by Joshi logo" };

export const metadata: Metadata = {
  title,
  description,
  openGraph: { title, description, type: "website", images: [shareImage] },
  twitter: { card: "summary", title, description, images: [shareImage] },
};

export default function GalleryPage() {
  return <SpotlightGallery />;
}
