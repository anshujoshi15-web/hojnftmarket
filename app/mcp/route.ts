import { agentTools, callAgentTool, mcpCapabilities, mcpProtocolVersions, mcpServerInfo } from "@/lib/aura-agent-tools";
import { siteOrigin } from "@/lib/aura-discovery";

type RpcId = string | number | null;
const responseHeaders = { "Cache-Control": "no-store" };

function rpcError(id: RpcId, code: number, message: string, status = 200) {
  return Response.json({ jsonrpc: "2.0", id, error: { code, message } }, { status, headers: responseHeaders });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function GET() {
  return new Response(null, { status: 405, headers: { ...responseHeaders, Allow: "POST" } });
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== siteOrigin && origin !== new URL(request.url).origin) {
    return rpcError(null, -32000, "Origin not allowed", 403);
  }
  const protocol = request.headers.get("mcp-protocol-version");
  if (protocol && !mcpProtocolVersions.includes(protocol)) {
    return rpcError(null, -32600, "Unsupported MCP protocol version", 400);
  }
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return rpcError(null, -32600, "Expected application/json", 415);
  }
  const reader = request.body?.getReader();
  if (!reader) return rpcError(null, -32700, "Missing JSON body", 400);
  let body = "";
  let size = 0;
  const decoder = new TextDecoder();
  try {
    for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
      size += chunk.value.byteLength;
      if (size > 16_384) {
        await reader.cancel();
        return rpcError(null, -32600, "Request too large", 413);
      }
      body += decoder.decode(chunk.value, { stream: true });
    }
    body += decoder.decode();
  } catch {
    return rpcError(null, -32700, "Could not read request", 400);
  }

  let message: unknown;
  try { message = JSON.parse(body); }
  catch { return rpcError(null, -32700, "Invalid JSON", 400); }
  if (!isObject(message) || message.jsonrpc !== "2.0") {
    return rpcError(null, -32600, "Invalid JSON-RPC request", 400);
  }
  if (!("method" in message) && "id" in message && ("result" in message || "error" in message)) {
    return new Response(null, { status: 202, headers: responseHeaders });
  }
  if (typeof message.method !== "string") return rpcError(null, -32600, "Invalid method", 400);
  if (!("id" in message)) return new Response(null, { status: 202, headers: responseHeaders });
  const id = message.id;
  if (typeof id !== "string" && typeof id !== "number" && id !== null) {
    return rpcError(null, -32600, "Invalid request ID", 400);
  }
  const params = message.params;
  const ok = (result: unknown) => Response.json({ jsonrpc: "2.0", id, result }, { headers: responseHeaders });

  switch (message.method) {
    case "initialize": {
      const requested = isObject(params) ? params.protocolVersion : undefined;
      if (typeof requested !== "string") return rpcError(id, -32602, "protocolVersion is required");
      return ok({
        protocolVersion: mcpProtocolVersions.includes(requested) ? requested : mcpProtocolVersions[0],
        capabilities: mcpCapabilities,
        serverInfo: mcpServerInfo,
      });
    }
    case "ping": return ok({});
    case "tools/list": return ok({ tools: agentTools });
    case "tools/call": {
      if (!isObject(params) || !agentTools.some(tool => tool.name === params.name) || typeof params.name !== "string") {
        return rpcError(id, -32602, "Unknown or missing tool name");
      }
      try {
        return ok({ content: [{ type: "text", text: JSON.stringify(callAgentTool(params.name, params.arguments)) }] });
      } catch {
        return ok({ isError: true, content: [{ type: "text", text: "Arguments do not match the tool schema." }] });
      }
    }
    default: return rpcError(id, -32601, "Method not found");
  }
}
