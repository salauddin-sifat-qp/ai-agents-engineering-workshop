import { runAgent, type Tool } from "./agent.ts";
import type { LLMProvider } from "llm-provider/provider";

export interface SubAgentTask {
  task: string;
  tools: Tool[];
}

// A sub-agent gets its own fresh message history and only the tools its
// task needs - never the parent's full conversation. It runs the same loop
// as the top-level agent, just scoped down.
export async function spawnAgent(
  provider: LLMProvider,
  { task, tools }: SubAgentTask,
): Promise<string> {
  const systemPrompt =
    "You are a focused sub-agent. Complete only the task you were given, " +
    "using only the tools available to you, and report a concise result.";

  return runAgent(provider, tools, systemPrompt, task);
}
