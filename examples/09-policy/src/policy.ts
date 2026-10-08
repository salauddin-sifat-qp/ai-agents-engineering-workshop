import { createInterface } from "node:readline/promises";
import type { Tool, ToolKind } from "./registry.ts";

export type Approval = "automatic" | "approval" | "blocked";

// Example policy: reads are automatic, execution needs a human in the loop,
// nothing in this workshop is destructive enough to hard-block, but a real
// policy would map some tool names straight to "blocked".
//
// This is the table behind Claude Code's allow / ask / deny rules and pi's
// permission prompts: same three outcomes, keyed on what the tool does.
const POLICY_BY_KIND: Record<ToolKind, Approval> = {
  read: "automatic",
  write: "approval",
  execute: "approval",
};

export type HookDecision = { allow: true } | { allow: false; reason: string };

// A pre-tool hook: code the runtime calls before EVERY tool call, which can
// stop it. Claude Code's PreToolUse hooks and pi's extension events have the
// same shape. The model never sees this code run, only its decision.
export async function beforeToolCall(tool: Tool, args: unknown): Promise<HookDecision> {
  const approval = POLICY_BY_KIND[tool.kind];

  if (approval === "blocked") {
    return { allow: false, reason: `Blocked by policy: ${tool.schema.name} is not permitted.` };
  }

  if (approval === "approval" && !(await confirm(tool.schema.name, args))) {
    return { allow: false, reason: `Denied by operator: ${tool.schema.name} was not approved.` };
  }

  return { allow: true };
}

async function confirm(toolName: string, args: unknown): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`Approve ${toolName}(${JSON.stringify(args)})? [y/N] `);
  rl.close();
  return answer.trim().toLowerCase() === "y";
}
