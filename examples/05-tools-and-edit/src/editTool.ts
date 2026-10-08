import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ToolSchema } from "llm-provider/provider";

const FIXTURE_ROOT = path.resolve(import.meta.dirname, "fixture/pokedex-api");

// Files the agent has read during THIS run. The edit tool refuses to touch
// anything not in here. Every serious coding harness enforces some version of
// this rule, because a model editing a file it hasn't read is editing a file
// it is remembering, and what it remembers is often last week's version.
const filesRead = new Set<string>();

export function markRead(relativePath: string): void {
  filesRead.add(normalize(relativePath));
}

export function hasRead(relativePath: string): boolean {
  return filesRead.has(normalize(relativePath));
}

export const editFileSchema: ToolSchema = {
  name: "edit_file",
  description:
    "Replace an exact snippet of text in a file. You must read the file first. " +
    "`old_text` must appear EXACTLY once - include surrounding lines if the " +
    "snippet would otherwise be ambiguous. Set `dry_run` to true to preview the " +
    "diff without writing.",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "File path relative to the project root" },
      old_text: { type: "string", description: "Exact text to replace, including indentation" },
      new_text: { type: "string", description: "Replacement text" },
      dry_run: { type: "boolean", description: "Preview the change without writing it" },
    },
    required: ["path", "old_text", "new_text"],
  },
};

export interface EditArgs {
  path: string;
  old_text: string;
  new_text: string;
  dry_run?: boolean;
}

export async function editFile(args: EditArgs): Promise<string> {
  const { path: relativePath, old_text: oldText, new_text: newText } = args;

  // Four failure modes, four distinct messages. The model only recovers from a
  // failure it can distinguish - "edit failed" teaches it nothing, so it
  // retries the identical call and burns the iteration budget.
  if (!hasRead(relativePath)) {
    return `Refused: you have not read ${relativePath} yet. Call read_file first.`;
  }

  const absolute = resolveInFixture(relativePath);
  const before = await readFile(absolute, "utf-8");
  const occurrences = countOccurrences(before, oldText);

  if (occurrences === 0) {
    return (
      `No match for old_text in ${relativePath}. The file on disk does not contain ` +
      `that exact string - check whitespace and indentation, or read the file again.`
    );
  }

  if (occurrences > 1) {
    return (
      `old_text matched ${occurrences} times in ${relativePath}; it must match exactly once. ` +
      `Include more surrounding context to make it unique.`
    );
  }

  // A replacer function, not a string: a string replacement treats `$&`, `$'`
  // and `$$` as patterns, and code is full of dollar signs.
  const after = before.replace(oldText, () => newText);
  const diff = renderDiff(relativePath, oldText, newText);

  if (args.dry_run) return `Dry run, nothing written.\n${diff}`;

  await writeFile(absolute, after, "utf-8");
  return `Edited ${relativePath}.\n${diff}`;
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  return haystack.split(needle).length - 1;
}

// A diff, not a success message. The human watching the run has to be able to
// see what actually changed without opening the file.
function renderDiff(relativePath: string, oldText: string, newText: string): string {
  const removed = oldText.split("\n").map((line) => `- ${line}`);
  const added = newText.split("\n").map((line) => `+ ${line}`);
  return [`--- ${relativePath}`, ...removed, ...added].join("\n");
}

function normalize(relativePath: string): string {
  return path.relative(FIXTURE_ROOT, resolveInFixture(relativePath));
}

function resolveInFixture(relativePath: string): string {
  const resolved = path.resolve(FIXTURE_ROOT, relativePath);
  // Separator matters: "pokedex-api-secrets" also starts with "pokedex-api".
  if (resolved !== FIXTURE_ROOT && !resolved.startsWith(FIXTURE_ROOT + path.sep)) {
    throw new Error(`Path escapes the fixture project: ${relativePath}`);
  }
  return resolved;
}
