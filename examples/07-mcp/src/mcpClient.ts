import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { Tool } from "./agent.ts";

export interface DiscoveredTool extends Tool {
  // From the server's `readOnlyHint` annotation. MCP's version of the
  // read/write/execute tag from example 05 - and it is only a *hint*, written
  // by whoever wrote the server. Trust it as far as you trust them.
  readOnly: boolean;
}

// Turns whatever tools an MCP server advertises into the same `Tool` shape
// the agent loop already knows how to run. The agent doesn't know or care
// that these calls go over MCP instead of being local functions.
//
// Note what else crosses this line: every `description` here was written by
// the server's author and goes straight into the model's prompt. A server you
// connect to is content you trust.
export async function discoverTools(client: Client): Promise<DiscoveredTool[]> {
  const { tools } = await client.listTools();

  return tools.map((tool) => ({
    schema: {
      name: tool.name,
      description: tool.description ?? "",
      parameters: tool.inputSchema,
    },
    readOnly: tool.annotations?.readOnlyHint === true,
    run: async (args: Record<string, unknown>) => {
      const result = await client.callTool({
        name: tool.name,
        arguments: args,
      });
      const content = result.content as Array<{ type: string; text?: string }>;
      const text = content.find((block) => block.type === "text")?.text ?? "";
      // MCP reports tool failures in-band. Keep the flag, or the model reads
      // an error message as if it were a successful result.
      return result.isError ? `Tool error: ${text}` : text;
    },
  }));
}
