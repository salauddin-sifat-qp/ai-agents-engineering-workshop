import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { runAgent } from "./agent.ts";
import { loadConfig } from "llm-provider/config";
import { discoverTools } from "./mcpClient.ts";
import { OpenAICompatibleProvider } from "llm-provider/provider";

// The point of this file: we did not write this server. It's the official
// MCP filesystem reference server, published on npm, used unmodified.
// discoverTools() and runAgent() are the exact same functions this example's
// own server used - the harness doesn't know or care who built the server
// on the other end, that's the whole payoff of a protocol.
// fileURLToPath, not `.pathname`: a path with a space in it would arrive as %20.
const fixtureRoot = fileURLToPath(new URL("fixture/pokedex-api", import.meta.url));

const transport = new StdioClientTransport({
  command: "npx",
  args: ["-y", "@modelcontextprotocol/server-filesystem", fixtureRoot],
});

const client = new Client({ name: "workshop-agent", version: "1.0.0" });
await client.connect(transport);

const discovered = await discoverTools(client);
console.log(
  `Discovered ${discovered.length} tools from a server we didn't write: ${discovered.map((t) => t.schema.name).join(", ")}`,
);

// Connecting to a server hands the model every tool it offers - this one
// includes write_file, edit_file and move_file. This task only needs to read,
// so the harness allowlists read-only tools. Same idea as permission modes in
// Claude Code: the client, not the server, decides what the model may touch.
const tools = discovered.filter((tool) => tool.readOnly);
const withheld = discovered.filter((tool) => !tool.readOnly).map((t) => t.schema.name);
console.log(`Withheld from the model (not read-only): ${withheld.join(", ") || "(none)"}`);

const config = loadConfig();
const provider = new OpenAICompatibleProvider(config);

// This server has no run_tests tool - it only knows about files. The task
// has to fit what's actually on offer, same as integrating any real
// third-party server.
const systemPrompt =
  "You are an engineering agent. Use directory_tree and read_text_file to investigate a small TypeScript project.";

const answer = await runAgent(
  provider,
  tools,
  systemPrompt,
  "Find the line of code in this project that causes a whitespace-handling bug, and quote it.",
);

console.log(answer);
await client.close();
