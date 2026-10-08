import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadConfig } from "llm-provider/config";
import { OpenAICompatibleProvider } from "llm-provider/provider";
import { score, type EvalTask } from "./score.ts";
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
import { createTracer, readTrace, TRACE_DIR } from "./tracer.ts";

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
  "Use the available tools to answer the question.";

const dataset = await loadDataset();

async function loadDataset(): Promise<EvalTask[]> {
  const raw = await readFile(new URL("dataset.json", import.meta.url), "utf-8");
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `dataset.json is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

const runId = Date.now();
let passed = 0;
for (const [index, evalTask] of dataset.entries()) {
  // Run traced, then score the trace file - not the agent's return value.
  // Anything the eval checks, a human can check later from the same file.
  const traceFile = path.join(TRACE_DIR, `eval-${runId}-${index + 1}.jsonl`);
  await runTracedAgent(
    provider,
    config,
    tools,
    systemPrompt,
    evalTask.task,
    createTracer(traceFile, false),
    evalTask.maxIterations,
  );
  const result = score(evalTask, readTrace(traceFile));

  console.log(`\n${result.pass ? "PASS" : "FAIL"} - ${result.task}`);
  // Print the path either way. A FAIL on a path that still reached the right
  // answer is the scorer's blind spot, not the agent's.
  console.log(`  trajectory: ${result.trajectory.join(" -> ") || "(no tools)"}`);
  console.log(`  trace:      ${traceFile}`);
  result.reasons.forEach((reason) => console.log(`  - ${reason}`));
  if (result.pass) passed++;
}

console.log(`\n${passed}/${dataset.length} passed`);
