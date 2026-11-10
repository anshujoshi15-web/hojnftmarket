"use client";

import { useEffect } from "react";
import { agentTools, callAgentTool } from "@/lib/aura-agent-tools";

type ModelContext = {
  registerTool: (
    tool: (typeof agentTools)[number] & { execute: (args: unknown) => unknown },
    options?: { signal: AbortSignal },
  ) => void | Promise<void>;
  unregisterTool?: (name: string) => void;
};

export function WebMcpTools() {
  useEffect(() => {
    const modern = (document as Document & { modelContext?: ModelContext }).modelContext;
    const context = modern ?? (navigator as Navigator & { modelContext?: ModelContext }).modelContext;
    if (!context?.registerTool) return;

    const controller = new AbortController();
    const legacyTools: string[] = [];
    for (const tool of agentTools) {
      try {
        const registration = context.registerTool({
          ...tool,
          execute: args => ({
            content: [{ type: "text", text: JSON.stringify(callAgentTool(tool.name, args)) }],
          }),
        }, modern ? { signal: controller.signal } : undefined);
        if (!modern) legacyTools.push(tool.name);
        void Promise.resolve(registration).catch(error => {
          if (!controller.signal.aborted) console.warn("Could not register WebMCP tool", tool.name, error);
        });
      } catch (error) {
        console.warn("Could not register WebMCP tool", tool.name, error);
      }
    }
    return () => {
      controller.abort();
      for (const name of legacyTools) context.unregisterTool?.(name);
    };
  }, []);

  return null;
}
