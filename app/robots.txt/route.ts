import { siteUrl } from "@/lib/aura-discovery";

export function GET() {
  const policy = [
    "User-agent: *",
    "Content-Signal: search=yes, ai-train=no",
    "Allow: /",
    "Disallow: /admin",
    "Disallow: /account",
    "Disallow: /legacy/account",
    "Disallow: /notifications",
    "Disallow: /profile",
    "Disallow: /wallet",
    "Disallow: /cart",
    "Disallow: /favorites",
    "",
    `Sitemap: ${siteUrl("/sitemap.xml")}`,
    "",
  ].join("\n");
  return new Response(policy, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
