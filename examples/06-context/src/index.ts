import { loadConfig } from "llm-provider/config";
import { type ChatMessage, OpenAICompatibleProvider } from "llm-provider/provider";
import { runAgent } from "./agent.ts";
import { loadMemory, remember, rememberSchema } from "./memory.ts";
import { ToolRegistry } from "./registry.ts";
import { loadSession, sessionPath, startSession } from "./session.ts";
import {
  listFiles,
  listFilesSchema,
  readFileSchema,
  readFileTool,
  runTests,
  runTestsSchema,
  searchCode,
  searchCodeSchema,
} from "./tools.ts";

const provider = new OpenAICompatibleProvider(loadConfig());

const registry = new ToolRegistry();
registry.register({ schema: searchCodeSchema, kind: "read", run: searchCode });
registry.register({ schema: readFileSchema, kind: "read", run: readFileTool });
registry.register({ schema: listFilesSchema, kind: "read", run: listFiles });
registry.register({ schema: runTestsSchema, kind: "execute", run: runTests });
registry.register({ schema: rememberSchema, kind: "write", run: remember });

// --fork <id> resumes from an earlier entry instead of the last one. The new
// run becomes a sibling branch; the old one stays in the file.
const forkIndex = process.argv.indexOf("--fork");
const forkFrom = forkIndex === -1 ? undefined : process.argv[forkIndex + 1];
if (forkIndex !== -1 && !forkFrom) {
  console.error("Usage: pnpm 06:fork <entry id>   (ids: jq -c '{id, parentId, type}' on the session file)");
  process.exit(1);
}
const resuming = process.argv.includes("--resume") || forkFrom !== undefined;
const memory = await loadMemory();

// Three layers, in priority order, all of them just strings we chose to
// concatenate. Nothing about this is magic: "memory" is a file, and the model
// cannot tell the difference between a fact we loaded from disk and a fact we
// typed here.
const systemPrompt = [
  "You are an engineering agent investigating a small TypeScript project.",
  "Use the tools to find and explain the cause of any failing test.",
  "If you learn something durable about how this project works, call remember.",
  memory ? `\n--- project memory (AGENTS.md) ---\n${memory}` : "",
].join(" ");

const task = "Read every source file in the project, then explain why the test suite is failing.";

const fresh: ChatMessage[] = [
  { role: "system", content: systemPrompt },
  { role: "user", content: task },
];

const restored = resuming ? await loadSession(forkFrom) : undefined;
if (resuming) {
  console.log(
    restored
      ? `${forkFrom ? `Forked from ${forkFrom}` : "Resumed"}: ${restored.length} messages from ${sessionPath}\n`
      : `No saved session at ${sessionPath}, starting fresh.\n`,
  );
}

// A transcript that ends in a final answer is a finished session, not an
// interrupted one. Re-sending it would just ask the model to answer twice.
const last = restored?.at(-1);
if (last?.role === "assistant" && !last.toolCalls?.length) {
  console.log(`That session already finished. Its answer was:\n\n${last.content}`);
  console.log("\nRun `pnpm 06` for a fresh one, and Ctrl-C it partway to test resume.");
  process.exit(0);
}

if (!restored) await startSession(fresh);

const { answer, state } = await runAgent(provider, registry, restored ?? fresh);

console.log(`\n${answer}`);
console.log("\n--- context report ---");
console.log(`iterations:   ${state.iterations}`);
console.log(`tool calls:   ${JSON.stringify(state.toolCallsByName)}`);
console.log(`compactions:  ${state.compactions}`);
console.log(`peak context: ~${state.peakTokens} tokens`);
console.log(`\nSession saved to ${sessionPath}`);
console.log("Resume it with:  pnpm 06:resume");
console.log(`See the tree:    jq -c '{id, parentId, type}' ${sessionPath}`);
console.log("Fork from one:   pnpm 06:fork <id>");
