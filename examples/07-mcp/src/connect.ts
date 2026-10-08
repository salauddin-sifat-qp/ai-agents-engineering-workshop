import path from "node:path";

// Prints the one command that connects YOUR daily tool to the server in this
// folder. Same server code the workshop agent talks to; a different client.
const server = path.resolve(import.meta.dirname, "stdio-server.ts");
const tsx = path.resolve(import.meta.dirname, "../node_modules/.bin/tsx");

console.log("Connect the Pokédex MCP server to the agent you use every day:\n");
console.log(`  pi:          pi mcp add pokedex -- ${tsx} ${server}`);
console.log(`  Claude Code: claude mcp add pokedex -- ${tsx} ${server}`);
console.log("\nOr add it to a client's mcp.json by hand:\n");
console.log(
  JSON.stringify({ mcpServers: { pokedex: { command: tsx, args: [server] } } }, null, 2),
);
console.log("\nThen ask it: \"Why is the Pokédex test suite failing?\"");
console.log("Its tools run `npm test` in the fixture - approve run_tests when it asks.");
