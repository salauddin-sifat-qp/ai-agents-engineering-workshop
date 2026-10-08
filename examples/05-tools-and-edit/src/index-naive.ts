import { loadConfig } from "llm-provider/config";
import { OpenAICompatibleProvider } from "llm-provider/provider";
import { runAgent } from "./agent.ts";
import { writeFileSchema, writeFileTool } from "./naiveWrite.ts";
import { ToolRegistry } from "./registry.ts";
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
registry.register({ schema: writeFileSchema, kind: "write", run: writeFileTool });

const systemPrompt =
  "You are an engineering agent working on a small TypeScript project. " +
  "Use write_file to fix problems you find, then run the tests.";

const { answer, state } = await runAgent(
  provider,
  registry,
  systemPrompt,
  "The Pokédex API test suite is failing. Find the bug, fix it, and prove the fix by running the tests.",
);

console.log(`\n${answer}`);
console.log("\n--- run summary ---");
console.log(`iterations:   ${state.iterations}`);
console.log(`tool calls:   ${JSON.stringify(state.toolCallsByName)}`);
console.log(`files edited: ${state.filesEdited.join(", ") || "(none)"}`);
console.log("\nNow look at what it actually did:");
console.log("  git diff --stat examples/05-tools-and-edit/src/fixture");
console.log("  git diff examples/05-tools-and-edit/src/fixture");
console.log("read_file showed the model only the first part of pokedex.ts. write_file");
console.log("saved whatever it reproduced - count what vanished below the cut.");
console.log("Then run the tests. They don't cover what was lost, so they may pass.");
console.log("Undo it:  pnpm --filter 05-tools-and-edit reset");
