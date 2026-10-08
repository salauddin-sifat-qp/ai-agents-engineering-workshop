import type { ChatMessage, LLMProvider } from "llm-provider/provider";

// Deliberately tiny so compaction fires within one short workshop run. A real
// harness sets this from the model's context window, usually triggering
// somewhere around 70-80% full.
export const COMPACT_THRESHOLD_CHARS = 6_000;

// Rough enough. Real harnesses read `usage.prompt_tokens` off the API response
// instead of estimating, but the mechanic is identical: measure the context,
// compare against a threshold, act before the wall.
export function estimateTokens(messages: ChatMessage[]): number {
  return Math.round(contextSize(messages) / 4);
}

export function contextSize(messages: ChatMessage[]): number {
  return messages.reduce(
    (total, message) =>
      total +
      message.content.length +
      (message.toolCalls ? JSON.stringify(message.toolCalls).length : 0),
    0,
  );
}

/**
 * Truncation throws away the tail. Compaction *summarises* it and keeps going.
 *
 * The split matters: the system prompt and the original task stay verbatim
 * (lose those and the agent forgets what it was doing), the oldest middle
 * turns get replaced by a summary the model writes itself, and the most recent
 * turns survive intact because that is where the live work is.
 *
 *   [system] [task] [....... summarised .......] [recent turns kept verbatim]
 */
export async function compact(
  provider: LLMProvider,
  messages: ChatMessage[],
  keepRecent = 4,
): Promise<ChatMessage[]> {
  const system = messages[0];
  const task = messages[1];
  if (!system || !task) return messages;

  let start = Math.max(2, messages.length - keepRecent);

  // "Recent" is a count, but the budget is size. If one huge tool result sits
  // in the recent window, keeping it verbatim leaves the context over the
  // threshold and compaction fires again every turn. Shrink the window until
  // it fits in half the budget, or only the last message is left.
  while (
    start < messages.length - 1 &&
    contextSize(messages.slice(start)) > COMPACT_THRESHOLD_CHARS / 2
  ) {
    start++;
  }

  // A tool result must always follow its tool call: cut between them and the
  // kept result is an orphan the provider rejects. Snap the cut forward past
  // tool results, so they are summarised together with their call.
  while (start < messages.length && messages[start]?.role === "tool") start++;

  // Nothing left after snapping means the cut was inside the latest call's
  // results. That call is the live work: keep the whole group verbatim.
  if (start === messages.length) {
    start = messages.length - 1;
    while (start > 2 && messages[start]?.role === "tool") start--;
  }

  const middle = messages.slice(2, start);
  const recent = messages.slice(start);
  if (middle.length === 0) return messages;

  // Tool calls live in `toolCalls`, not `content`. Leave them out and the
  // summariser sees file contents with no idea which file they came from.
  const transcript = middle.map(describe).join("\n");

  const summary = await provider.chat({
    messages: [
      {
        role: "system",
        content:
          "Summarise this agent transcript for your own future reference. " +
          "Keep: files inspected, what was found in them, what has been ruled " +
          "out, and what remains to be done. Drop: raw file contents and tool " +
          "chatter. Be specific about file paths and function names.",
      },
      { role: "user", content: transcript },
    ],
  });

  return [
    system,
    task,
    { role: "assistant", content: `[summary of earlier work]\n${summary.message.content}` },
    ...recent,
  ];
}

function describe(message: ChatMessage): string {
  const calls = (message.toolCalls ?? [])
    .map((call) => `${call.name}(${JSON.stringify(call.arguments)})`)
    .join(", ");
  const content = message.content.slice(0, 600);
  if (!calls) return `${message.role}: ${content}`;
  return `${message.role} called ${calls}` + (content ? `: ${content}` : "");
}
