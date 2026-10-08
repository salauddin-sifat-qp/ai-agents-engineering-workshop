import { loadConfig } from "llm-provider/config";
import { OpenAICompatibleProvider } from "llm-provider/provider";
import { runAgent } from "./agent.ts";
import { editFile, editFileSchema } from "./editTool.ts";
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
registry.register({ schema: editFileSchema, kind: "write", run: editFile });

// The workflow is in the prompt, but the *enforcement* is in the tool. State
// the rule so the model cooperates; enforce it in code so it cannot skip it.
const systemPrompt =
  "You are an engineering agent working on a small TypeScript project. " +
  "Workflow: read a file before editing it, make the smallest edit that fixes " +
  "the problem, then run the tests to prove the fix. " +
  "edit_file replaces an exact snippet - copy old_text verbatim from what you " +
  "read, including indentation. Stop as soon as the tests pass.";

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
console.log("\nInspect the change:  git diff examples/05-tools-and-edit/src/fixture");
console.log("Undo it:             pnpm --filter 05-tools-and-edit reset");
