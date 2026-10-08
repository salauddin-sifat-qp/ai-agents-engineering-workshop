# 07 - MCP

Most harnesses are MCP **clients** far more often than they're MCP
**servers** — you're usually connecting to tools someone else built, not
building tools for someone else to connect to. This example leads with
that.

## Client-first: talking to a server you didn't write (`index-external.ts`)

Connects to the official, unmodified MCP reference server `@modelcontextprotocol/server-filesystem`
(installed on the fly via `npx`, no code of ours involved) pointed at the
Pokédex fixture. `mcpClient.ts`'s `discoverTools()` and `agent.ts`'s
`runAgent()` are the exact same functions used everywhere else in this
workshop - the harness doesn't know or care that this server is a real,
external package it's never seen before.

That server has no `run_tests` tool, only file tools, so the task is
scoped to what it can actually do - same constraint you'd hit integrating
any real third-party server.

It also offers `write_file`, `edit_file` and `move_file`. Connecting to a
server hands the model every tool it exposes, so the client decides what to
pass through: `discoverTools()` keeps each tool's `readOnlyHint` annotation
(MCP's version of the read/write/execute tag), and this task allowlists the
read-only ones. Hints are written by the server's author - trust them as far
as you trust the author. The same goes for tool descriptions, which go
straight into the model's prompt.

```bash
pnpm --filter 07-mcp start:external
```

## Building your own server (`mcpServer.ts`, `stdio-server.ts`)

The same four tools from earlier examples, exposed through MCP over stdio:
the client spawns the server as a child process, no networking involved.
Each tool carries annotations (`readOnlyHint`, `destructiveHint`), MCP's
version of the read/write/execute tag. Clients read them to decide what runs
without asking.

```bash
pnpm --filter 07-mcp test:fixture
pnpm 07:server
```

## Connect your own tool to it (`connect.ts`)

The same server works with any MCP client, including the agent you use every
day. This prints the exact command with this machine's paths:

```bash
pnpm 07:connect
```

It prints a `pi mcp add ...` line, a `claude mcp add ...` line, and an
`mcpServers` JSON block for clients configured by file. Then ask your own
agent why the Pokédex tests fail: it is now driving tools you wrote.

> A protocol decouples the agent runtime from the tool implementation.
