import type { Metadata } from "next";
import SpotlightGallery from "./spotlight-gallery";

export const metadata: Metadata = {
  title: "Artist Spotlight · AURA by Joshi",
  description: "Explore featured NFT artworks and collections in AURA’s 3D gallery.",
};

export default function GalleryPage() {
  return <SpotlightGallery />;
}
