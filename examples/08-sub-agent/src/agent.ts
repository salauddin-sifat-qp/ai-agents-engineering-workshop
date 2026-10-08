import type { ChatMessage, LLMProvider, ToolSchema } from "llm-provider/provider";

export interface Tool {
  schema: ToolSchema;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  run: (args: any) => Promise<string>;
}

const MAX_ITERATIONS = 8;
const TOOL_TIMEOUT_MS = 10_000;

// The agent loop: ask the model, execute what it asks for, feed the result
// back, repeat - until it stops requesting tools or we hit a safeguard.
export async function runAgent(
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
      return finalAnswer(response.message.content, response.finishReason);
    }

    messages.push(response.message);

    // A model may ask for several tools in one turn. Every call needs its own
    // result with the matching id, or the provider rejects the next request.
    for (const toolCall of toolCalls) {
      const tool = toolsByName.get(toolCall.name);
      const result = tool
        ? await runWithTimeout(tool.run(toolCall.arguments), TOOL_TIMEOUT_MS)
        : `Unknown tool: ${toolCall.name}`;

      messages.push({ role: "tool", content: result, toolCallId: toolCall.id });
    }
  }

  return `Gave up after ${MAX_ITERATIONS} iterations without a final answer.`;
}

// "length" means the model was cut off mid-answer. Passing that off as a
// finished answer is how a harness reports half a result as a whole one.
function finalAnswer(content: string, finishReason: string | undefined): string {
  return finishReason === "length" ? `${content}\n[cut off: output token limit reached]` : content;
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
    // A pending timer keeps Node alive: without this the process hangs for
    // up to TOOL_TIMEOUT_MS after the agent has already answered. The tool
    // itself is not cancelled - a timeout stops the waiting, not the work.
    clearTimeout(timer);
  }
}
