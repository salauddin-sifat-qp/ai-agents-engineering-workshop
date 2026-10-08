import { appendFile, readFile } from "node:fs/promises";
import path from "node:path";
import type { ToolSchema } from "llm-provider/provider";

// The same idea as CLAUDE.md, AGENTS.md, or pi's memory: a plain markdown file
// in the project that the harness reads at startup and pastes into the system
// prompt. There is no vector store and no retrieval step. "Memory" in a coding
// harness is, almost always, just a file somebody remembered to load.
const MEMORY_FILE = path.resolve(import.meta.dirname, "fixture/pokedex-api/AGENTS.md");

export async function loadMemory(): Promise<string> {
  try {
    return (await readFile(MEMORY_FILE, "utf-8")).trim();
  } catch {
    return "";
  }
}

export const rememberSchema: ToolSchema = {
  name: "remember",
  description:
    "Save a durable fact about this project to AGENTS.md so future sessions " +
    "start knowing it. Use for conventions and hard-won gotchas, never for " +
    "notes about the current task.",
  parameters: {
    type: "object",
    properties: {
      fact: { type: "string", description: "One sentence, stated as a project fact" },
    },
    required: ["fact"],
  },
};

export async function remember({ fact }: { fact: string }): Promise<string> {
  await appendFile(MEMORY_FILE, `\n- ${fact.trim()}\n`, "utf-8");
  return `Saved to AGENTS.md: ${fact.trim()}`;
}

export const memoryPath = MEMORY_FILE;
