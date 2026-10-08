import type { LLMConfig } from "llm-provider/config";
import type { ChatMessage, LLMProvider, ToolSchema } from "llm-provider/provider";
import { timed, type Tracer } from "./tracer.ts";

export interface Tool {
  schema: ToolSchema;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  run: (args: any) => Promise<string>;
}

const TOOL_TIMEOUT_MS = 10_000;
const PREVIEW_CHARS = 200;

interface ToolRun {
  ok: boolean;
  output: string;
}

export async function runTracedAgent(
  provider: LLMProvider,
  config: LLMConfig,
  tools: Tool[],
  systemPrompt: string,
  task: string,
  trace: Tracer,
  maxIterations = 8,
): Promise<string> {
  const toolsByName = new Map(tools.map((tool) => [tool.schema.name, tool]));
  const schemas = tools.map((tool) => tool.schema);
  const runStart = performance.now();
  const totals = { promptTokens: 0, completionTokens: 0 };

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: task },
  ];

  const endRun = (iterations: number, finished: boolean) =>
    trace({
      type: "run_end",
      iterations,
      finished,
      durationMs: Math.round(performance.now() - runStart),
      ...totals,
    });

  let iteration = 0;
  for (; iteration < maxIterations; iteration++) {
    const { result: response, durationMs: llmDuration } = await timed(() =>
      provider.chat({ messages, tools: schemas }),
    );
    totals.promptTokens += response.usage?.promptTokens ?? 0;
    totals.completionTokens += response.usage?.completionTokens ?? 0;
    trace({
      type: "llm_call",
      model: config.model,
      durationMs: llmDuration,
      promptTokens: response.usage?.promptTokens,
      completionTokens: response.usage?.completionTokens,
      finishReason: response.finishReason,
    });

    const toolCalls = response.message.toolCalls ?? [];
    if (toolCalls.length === 0) {
      endRun(iteration + 1, response.finishReason !== "length");
      return response.message.content;
    }

    messages.push(response.message);

    for (const toolCall of toolCalls) {
      const tool = toolsByName.get(toolCall.name);
      const { result, durationMs: toolDuration } = await timed(async (): Promise<ToolRun> =>
        tool
          ? runWithTimeout(tool.run(toolCall.arguments), TOOL_TIMEOUT_MS)
          : { ok: false, output: `Unknown tool: ${toolCall.name}` },
      );

      trace({
        type: "tool_call",
        name: toolCall.name,
        args: toolCall.arguments,
        durationMs: toolDuration,
        ok: result.ok,
        resultChars: result.output.length,
        resultPreview: result.output.slice(0, PREVIEW_CHARS),
      });
      messages.push({ role: "tool", content: result.output, toolCallId: toolCall.id });
    }
  }

  endRun(iteration, false);
  return `Gave up after ${maxIterations} iterations without a final answer.`;
}

// Returns `ok` separately from the text, so the trace records what actually
// happened instead of guessing from the string.
async function runWithTimeout(promise: Promise<string>, timeoutMs: number): Promise<ToolRun> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<ToolRun>((resolve) => {
    timer = setTimeout(
      () => resolve({ ok: false, output: `Tool timed out after ${timeoutMs}ms` }),
      timeoutMs,
    );
  });

  try {
    return await Promise.race([promise.then((output) => ({ ok: true, output })), timeout]);
  } catch (error) {
    return {
      ok: false,
      output: `Tool failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  } finally {
    clearTimeout(timer);
  }
}
