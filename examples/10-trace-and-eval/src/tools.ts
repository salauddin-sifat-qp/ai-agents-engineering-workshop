import { execFile } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type { ToolSchema } from "llm-provider/provider";

const execFileAsync = promisify(execFile);
const FIXTURE_ROOT = path.resolve(import.meta.dirname, "fixture/pokedex-api");

// Every path argument is resolved against the fixture root and checked to
// stay inside it - the agent can read the sample project, nothing else.
function resolveInFixture(relativePath: string): string {
  const resolved = path.resolve(FIXTURE_ROOT, relativePath);
  // Separator matters: "pokedex-api-secrets" also starts with "pokedex-api".
  if (resolved !== FIXTURE_ROOT && !resolved.startsWith(FIXTURE_ROOT + path.sep)) {
    throw new Error(`Path escapes the fixture project: ${relativePath}`);
  }
  return resolved;
}

export const searchCodeSchema: ToolSchema = {
  name: "search_code",
  description:
    "Search the Pokédex API source for a text match. Returns matching file paths and lines.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Text to search for" },
    },
    required: ["query"],
  },
};

export async function searchCode({ query }: { query: string }): Promise<string> {
  const files = await listSourceFiles(FIXTURE_ROOT);
  const matches: string[] = [];

  for (const file of files) {
    const content = await readFile(file, "utf-8");
    content.split("\n").forEach((line, index) => {
      if (line.includes(query)) {
        matches.push(`${path.relative(FIXTURE_ROOT, file)}:${index + 1}: ${line.trim()}`);
      }
    });
  }

  return matches.length > 0 ? matches.join("\n") : `No matches for "${query}"`;
}

async function listSourceFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.name === "node_modules") continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listSourceFiles(fullPath)));
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

export const readFileSchema: ToolSchema = {
  name: "read_file",
  description: "Read the contents of a file in the Pokédex API project.",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Path relative to the project root",
      },
    },
    required: ["path"],
  },
};

export async function readFileTool({ path: relativePath }: { path: string }): Promise<string> {
  return readFile(resolveInFixture(relativePath), "utf-8");
}

export const listFilesSchema: ToolSchema = {
  name: "list_files",
  description: "List files in the Pokédex API project, optionally under a sub-path.",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Sub-path to list, defaults to the project root",
      },
    },
  },
};

export async function listFiles({ path: relativePath }: { path?: string }): Promise<string> {
  const files = await listSourceFiles(resolveInFixture(relativePath ?? "."));
  return files.map((file) => path.relative(FIXTURE_ROOT, file)).join("\n");
}

export const runTestsSchema: ToolSchema = {
  name: "run_tests",
  description: "Run the Pokédex API test suite and return the results.",
  parameters: { type: "object", properties: {} },
};

export async function runTests(): Promise<string> {
  try {
    const { stdout } = await execFileAsync("npm", ["test"], {
      cwd: FIXTURE_ROOT,
    });
    return stdout;
  } catch (error) {
    const failure = error as { stdout?: string; stderr?: string };
    return failure.stdout ?? failure.stderr ?? String(error);
  }
}
