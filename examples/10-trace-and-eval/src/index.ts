import path from "node:path";
import { loadConfig } from "llm-provider/config";
import { OpenAICompatibleProvider } from "llm-provider/provider";
import {
  listFilesSchema,
  listFiles,
  readFileSchema,
  readFileTool,
  runTests,
  runTestsSchema,
  searchCode,
  searchCodeSchema,
} from "./tools.ts";
import { runTracedAgent, type Tool } from "./tracedAgent.ts";
import { createTracer, TRACE_DIR } from "./tracer.ts";

const config = loadConfig();
const provider = new OpenAICompatibleProvider(config);

const tools: Tool[] = [
  { schema: searchCodeSchema, run: searchCode },
  { schema: readFileSchema, run: readFileTool },
  { schema: listFilesSchema, run: listFiles },
  { schema: runTestsSchema, run: runTests },
];

const systemPrompt =
  "You are an engineering agent investigating a small TypeScript project. " +
  "Use the available tools to find and explain the cause of any failing test.";

const traceFile = path.join(TRACE_DIR, `run-${Date.now()}.jsonl`);

const answer = await runTracedAgent(
  provider,
  config,
  tools,
  systemPrompt,
  "Why is the Pokédex API test suite failing?",
  createTracer(traceFile),
);

console.log("\n--- final answer ---");
console.log(answer);
console.log(`\nTrace saved to ${traceFile}`);
console.log(`Tool calls only:  jq -c 'select(.type=="tool_call") | {name, ok}' ${traceFile}`);
