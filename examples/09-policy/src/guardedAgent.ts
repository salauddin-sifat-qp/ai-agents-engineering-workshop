import type { ChatMessage, LLMProvider } from "llm-provider/provider";
import { ToolError } from "./flakyTools.ts";
import { beforeToolCall } from "./policy.ts";
import type { Tool } from "./registry.ts";

const MAX_ITERATIONS = 8;
const TOOL_TIMEOUT_MS = 30_000;

// A structured tool result, always. The model gets the same shape whether
// the tool succeeded, failed, or was stopped by the policy hook, so it can
// decide what to do next instead of choking on an unexpected format.
interface ToolOutcome {
  ok: boolean;
  result?: string;
  error?: string;
  // Can calling it again help? Unknown errors default to false: repeating a
  // "file not found" just burns the budget.
  retryable?: boolean;
}

// Same loop as Example 03, with two layers around every tool call:
//
// 1. The policy hook runs first and can stop the call. The approval prompt
//    blocks the loop until a human answers.
// 2. Whatever happens comes back as a ToolOutcome. This is the SEMANTIC retry
//    from session 2: the harness does not retry tools behind the model's back.
//    It hands the failure to the model, and the model decides: try again, or
//    take another route.
//
// Why not retry here, like the provider retries a 429? Because a tool call is
// not always safe to repeat. A timed-out edit or test run may still be
// running; repeating it can apply the change twice.
export async function runGuardedAgent(
  provider: LLMProvider,
  tools: Tool[],
  systemPrompt: string,
  task: string,
): Promise<string> {
  const toolsByName = new Map(tools.map((tool) => [tool.schema.name, tool]));
  const schemas = tools.map((tool) => tool.schema);

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: task },
  ];

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    const response = await provider.chat({ messages, tools: schemas });
    const toolCalls = response.message.toolCalls ?? [];

    if (toolCalls.length === 0) {
      return response.message.content;
    }

    messages.push(response.message);

    for (const toolCall of toolCalls) {
      const tool = toolsByName.get(toolCall.name);
      const outcome: ToolOutcome = tool
        ? await runGuarded(tool, toolCall.arguments)
        : { ok: false, error: `Unknown tool: ${toolCall.name}`, retryable: false };

      console.log(
        `  ${toolCall.name}(${JSON.stringify(toolCall.arguments)}) -> ` +
          (outcome.ok ? "ok" : `ok:false  ${outcome.error} (retryable: ${outcome.retryable})`),
      );

      messages.push({ role: "tool", content: JSON.stringify(outcome), toolCallId: toolCall.id });
    }
  }

  return `Gave up after ${MAX_ITERATIONS} iterations without a final answer.`;
}

async function runGuarded(tool: Tool, args: unknown): Promise<ToolOutcome> {
  const decision = await beforeToolCall(tool, args);
  if (!decision.allow) return { ok: false, error: decision.reason, retryable: false };

  try {
    return { ok: true, result: await runWithTimeout(tool.run(args), TOOL_TIMEOUT_MS) };
  } catch (error) {
    if (error instanceof ToolError) {
      return { ok: false, error: error.message, retryable: error.retryable };
    }
    if (error instanceof TimeoutError) {
      return { ok: false, error: error.message, retryable: true };
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      retryable: false,
    };
  }
}

class TimeoutError extends Error {}

async function runWithTimeout(promise: Promise<string>, timeoutMs: number): Promise<string> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<string>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(`Timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
