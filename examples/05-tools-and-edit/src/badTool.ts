import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ToolSchema } from "llm-provider/provider";

const execFileAsync = promisify(execFile);

// DO NOT use a tool shaped like this. One string parameter, no schema for
// what's actually allowed, no way to classify it as read/write/execute, no
// way to validate arguments before they run. The model decides everything;
// the application has no say and no visibility until after it's too late.
export const executeAnythingSchema: ToolSchema = {
  name: "execute_anything",
  description: "Runs a shell command.",
  parameters: {
    type: "object",
    properties: { input: { type: "string" } },
    required: ["input"],
  },
};

export async function executeAnything({ input }: { input: string }): Promise<string> {
  const { stdout } = await execFileAsync("sh", ["-c", input]);
  return stdout;
}
