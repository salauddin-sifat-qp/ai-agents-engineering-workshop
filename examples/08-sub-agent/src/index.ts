import { loadConfig } from "llm-provider/config";
import { OpenAICompatibleProvider } from "llm-provider/provider";
import { runAgent, type Tool } from "./agent.ts";
import { spawnAgent } from "./spawnAgent.ts";
import {
  readFileSchema,
  readFileTool,
  runTests,
  runTestsSchema,
  searchCode,
  searchCodeSchema,
} from "./tools.ts";

const config = loadConfig();
const provider = new OpenAICompatibleProvider(config);

// Delegation is a tool call. This is the shape of Claude Code's Task tool:
// the PARENT model decides when to hand work off and writes the brief itself.
// Behind the tool is a whole agent loop with its own fresh history - the
// parent never sees its intermediate tool calls, only the report it returns.
const researchTools: Tool[] = [
  { schema: searchCodeSchema, run: searchCode },
  { schema: readFileSchema, run: readFileTool },
];

const delegate: Tool = {
  schema: {
    name: "delegate",
    description:
      "Hand a self-contained research task to a sub-agent that can search and read " +
      "the source code. It starts with no context, so the task must say everything it " +
      "needs to know. Returns only the sub-agent's final report.",
    parameters: {
      type: "object",
      properties: {
        task: { type: "string", description: "Complete, standalone instructions" },
      },
      required: ["task"],
    },
  },
  run: async ({ task }: { task: string }) => {
    console.log(`\n[parent -> sub-agent] ${task}`);
    const report = await spawnAgent(provider, { task, tools: researchTools });
    console.log(`[sub-agent -> parent] ${report.length} chars back\n`);
    return report;
  },
};

// The parent can run the tests but cannot read code itself - so anything it
// learns about the source has to come through a sub-agent.
const answer = await runAgent(
  provider,
  [{ schema: runTestsSchema, run: runTests }, delegate],
  "You are the lead engineer. You can run the tests, and you can delegate code " +
    "research to a sub-agent. Delegate rather than guessing about the source.",
  "Why is the Pokédex API test suite failing? Name the exact line to change.",
);

console.log("Parent's answer:");
console.log(answer);
