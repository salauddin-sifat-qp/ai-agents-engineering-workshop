import type { ChatMessage, LLMProvider } from "llm-provider/provider";
import { markRead } from "./editTool.ts";
import type { Tool } from "./registry.ts";
import { ToolRegistry } from "./registry.ts";

const MAX_ITERATIONS = 14;
const TOOL_TIMEOUT_MS = 60_000;
const MAX_TOOL_RESULT_CHARS = 4_000;

export interface AgentState {
  iterations: number;
  toolCallsByName: Record<string, number>;
  filesEdited: string[];
}

export async function runAgent(
  provider: LLMProvider,
  registry: ToolRegistry,
  systemPrompt: string,
  task: string,
): Promise<{ answer: string; state: AgentState }> {
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: task },
  ];

  const state: AgentState = { iterations: 0, toolCallsByName: {}, filesEdited: [] };

  for (; state.iterations < MAX_ITERATIONS; state.iterations++) {
    const response = await provider.chat({ messages, tools: registry.schemas() });
    const toolCalls = response.message.toolCalls ?? [];

    if (toolCalls.length === 0) {
      const cutOff = response.finishReason === "length" ? "\n[cut off: output token limit]" : "";
      return { answer: response.message.content + cutOff, state };
    }

    messages.push(response.message);

    for (const toolCall of toolCalls) {
      state.toolCallsByName[toolCall.name] = (state.toolCallsByName[toolCall.name] ?? 0) + 1;

      const tool = registry.get(toolCall.name);
      const result = tool
        ? await runWithTimeout(tool.run(toolCall.arguments), TOOL_TIMEOUT_MS)
        : `Unknown tool: ${toolCall.name}`;

      recordFileAccess(state, toolCall.name, toolCall.arguments, result);
      const seen = truncate(result);
      console.log(
        `  ${toolCall.name}(${summarizeArgs(toolCall.arguments)})` +
          (seen.length < result.length
            ? `  [model saw ${MAX_TOOL_RESULT_CHARS} of ${result.length} chars]`
            : ""),
      );

      messages.push({ role: "tool", content: seen, toolCallId: toolCall.id });
    }
  }

  return { answer: `Gave up after ${MAX_ITERATIONS} iterations.`, state };
}

// The read-before-write rule needs the runtime to remember what was read.
// That bookkeeping lives in the harness, never in the prompt - a rule the
// model is merely *asked* to follow is a rule it will eventually skip.
function recordFileAccess(
  state: AgentState,
  name: string,
  args: Record<string, unknown>,
  result: string,
): void {
  const target = typeof args.path === "string" ? args.path : undefined;
  if (!target) return;

  // A failed read is not a read: "Tool failed: ENOENT" taught the model nothing.
  if (name === "read_file" && !result.startsWith("Tool failed")) markRead(target);

  const wrote =
    (name === "edit_file" && result.startsWith("Edited")) ||
    (name === "write_file" && result === "ok");
  if (wrote && !state.filesEdited.includes(target)) state.filesEdited.push(target);
}

function summarizeArgs(args: Record<string, unknown>): string {
  return Object.entries(args)
    .map(([key, value]) => `${key}=${JSON.stringify(value).slice(0, 40)}`)
    .join(", ");
}

function truncate(result: string): string {
  if (result.length <= MAX_TOOL_RESULT_CHARS) return result;
  const omitted = result.length - MAX_TOOL_RESULT_CHARS;
  return `${result.slice(0, MAX_TOOL_RESULT_CHARS)}\n... [truncated ${omitted} more characters]`;
}

async function runWithTimeout(promise: Promise<string>, timeoutMs: number): Promise<string> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<string>((resolve) => {
    timer = setTimeout(() => resolve(`Tool timed out after ${timeoutMs}ms`), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } catch (error) {
    return `Tool failed: ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    clearTimeout(timer);
  }
}

export { ToolRegistry, type Tool };
