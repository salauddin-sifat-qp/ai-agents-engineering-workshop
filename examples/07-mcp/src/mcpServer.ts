import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { listFiles, readFileTool, runTests, searchCode } from "./tools.ts";

// The same four tools from earlier examples, now exposed through MCP instead
// of called as plain functions. The agent's job doesn't change - only how
// it reaches the tools does.
//
// Annotations are MCP's read/write/execute tag. A client such as pi or Claude
// Code reads them to decide what runs without asking. They are hints from the
// server's author: honest here, but a client trusts them only as far as it
// trusts whoever wrote the server.
const READ_ONLY = { readOnlyHint: true };

export function createServer(): McpServer {
  const server = new McpServer({
    name: "pokedex-engineering-tools",
    version: "1.0.0",
  });

  server.registerTool(
    "search_code",
    {
      description: "Search the Pokédex API source for a text match.",
      inputSchema: { query: z.string() },
      annotations: READ_ONLY,
    },
    async ({ query }) => ({
      content: [{ type: "text", text: await searchCode({ query }) }],
    }),
  );

  server.registerTool(
    "read_file",
    {
      description: "Read the contents of a file in the Pokédex API project.",
      inputSchema: { path: z.string() },
      annotations: READ_ONLY,
    },
    async ({ path }) => ({
      content: [{ type: "text", text: await readFileTool({ path }) }],
    }),
  );

  server.registerTool(
    "list_files",
    {
      description: "List files in the Pokédex API project.",
      inputSchema: { path: z.string().optional() },
      annotations: READ_ONLY,
    },
    async ({ path }) => ({
      content: [{ type: "text", text: await listFiles({ path }) }],
    }),
  );

  server.registerTool(
    "run_tests",
    {
      description: "Run the Pokédex API test suite and return the results.",
      // Runs a process, but changes nothing on disk.
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async () => ({ content: [{ type: "text", text: await runTests() }] }),
  );

  return server;
}
