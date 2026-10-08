import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { runAgent } from "./agent.ts";
import { loadConfig } from "llm-provider/config";
import { discoverTools } from "./mcpClient.ts";
import { OpenAICompatibleProvider } from "llm-provider/provider";

// The client spawns the MCP server as a child process and speaks to it over
// stdin/stdout - no ports, no networking, just a pipe.
const transport = new StdioClientTransport({
  command: "npx",
  args: ["tsx", "src/stdio-server.ts"],
});

const client = new Client({ name: "workshop-agent", version: "1.0.0" });
await client.connect(transport);

const tools = await discoverTools(client);
console.log(
  `Discovered ${tools.length} tools over MCP (stdio): ${tools.map((t) => t.schema.name).join(", ")}`,
);

const config = loadConfig();
const provider = new OpenAICompatibleProvider(config);

const systemPrompt =
  "You are an engineering agent investigating a small TypeScript project. " +
  "Use the available tools to find and explain the cause of any failing test.";

const answer = await runAgent(
  provider,
  tools,
  systemPrompt,
  "Why is the Pokédex API test suite failing?",
);
console.log(answer);

await client.close();
