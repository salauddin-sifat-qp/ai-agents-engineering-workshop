import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./mcpServer.ts";

await createServer().connect(new StdioServerTransport());
