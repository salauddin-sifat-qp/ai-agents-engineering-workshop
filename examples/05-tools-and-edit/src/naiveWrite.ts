import { writeFile } from "node:fs/promises";
import path from "node:path";
import type { ToolSchema } from "llm-provider/provider";

const FIXTURE_ROOT = path.resolve(import.meta.dirname, "fixture/pokedex-api");

// The write tool everyone builds first. It works, right up until it doesn't.
//
// Three problems, all of which you will watch happen live:
//   1. The model regenerates the WHOLE file from memory. Anything it forgot,
//      or never read, is now gone. Silently.
//   2. No read-before-write check, so it can clobber a file it has never seen.
//   3. No diff. The result is "ok", which tells the human nothing.
//
// Run `pnpm 05:naive`, then `git diff`, and count what it destroyed.
export const writeFileSchema: ToolSchema = {
  name: "write_file",
  description: "Write the full contents of a file, replacing whatever is there.",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "File path relative to the project root" },
      content: { type: "string", description: "The complete new contents of the file" },
    },
    required: ["path", "content"],
  },
};

export async function writeFileTool({
  path: relativePath,
  content,
}: {
  path: string;
  content: string;
}): Promise<string> {
  const resolved = path.resolve(FIXTURE_ROOT, relativePath);
  // Separator matters: "pokedex-api-secrets" also starts with "pokedex-api".
  if (resolved !== FIXTURE_ROOT && !resolved.startsWith(FIXTURE_ROOT + path.sep)) {
    throw new Error(`Path escapes the fixture project: ${relativePath}`);
  }

  await writeFile(resolved, content, "utf-8");
  return "ok";
}
