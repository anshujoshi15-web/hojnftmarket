import { agentTools, mcpCapabilities, mcpProtocolVersions, mcpServerInfo } from "@/lib/aura-agent-tools";
import { siteUrl } from "@/lib/aura-discovery";

export function GET() {
  return Response.json({
    version: "1.0",
    protocolVersion: mcpProtocolVersions[0],
    serverInfo: mcpServerInfo,
    description: "Read-only access to Aura by Joshi marketplace information and NFT search links.",
    iconUrl: siteUrl("/aura-mark.svg"),
    documentationUrl: siteUrl("/llms.txt"),
    transport: { type: "streamable-http", endpoint: siteUrl("/mcp") },
    capabilities: mcpCapabilities,
    tools: agentTools,
  }, { headers: { "Access-Control-Allow-Origin": "*" } });
}
