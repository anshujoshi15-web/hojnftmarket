import { publicPages, siteDescription, siteName, siteUrl, supportEmail } from "./aura-discovery";

export const agentTools = [
  {
    name: "get_marketplace_info",
    description: "Get Aura by Joshi’s marketplace description, support contact, and public page links.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "find_nft_search_link",
    description: "Build a link to search Aura for an NFT by name, collection, contract, or token ID. This tool returns a link, not live listings.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string", minLength: 1, maxLength: 200 } },
      required: ["query"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
];

export function callAgentTool(name: string, args: unknown = {}) {
  if (!args || typeof args !== "object" || Array.isArray(args)) throw new Error("Arguments must be an object.");
  if (name === "get_marketplace_info" && Object.keys(args).length === 0) {
    return {
      name: siteName,
      description: siteDescription,
      supportEmail,
      pages: publicPages.map(([path, title]) => ({ title, url: siteUrl(path) })),
    };
  }
  if (name === "find_nft_search_link" && Object.keys(args).length === 1 && "query" in args) {
    const query = typeof args.query === "string" ? args.query.trim() : "";
    if (query.length && query.length <= 200) {
      const url = new URL(siteUrl("/search"));
      url.searchParams.set("q", query);
      return { query, url: url.href };
    }
  }
  throw new Error("Arguments do not match the tool schema.");
}

export const mcpServerInfo = { name: "aura-by-joshi", title: siteName, version: "1.0.0" };
export const mcpProtocolVersions = ["2025-11-25", "2025-06-18", "2025-03-26"];
export const mcpCapabilities = { tools: {} };
