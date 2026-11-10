import type { Metadata } from "next";
import DiscoverPage from "./discover-page";
import { homeStructuredData, siteDescription, siteName, siteUrl } from "@/lib/aura-discovery";
import { WebMcpTools } from "./components/web-mcp-tools";

export const metadata: Metadata = {
  title: `AURA · ${siteName}`,
  description: siteDescription,
  alternates: { canonical: siteUrl("/") },
};

export default function HomePage() {
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{
      __html: JSON.stringify(homeStructuredData).replace(/</g, "\\u003c"),
    }} />
    <WebMcpTools />
    <DiscoverPage />
  </>;
}
