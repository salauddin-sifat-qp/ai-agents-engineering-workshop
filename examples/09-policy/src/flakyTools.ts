import type { ToolSchema } from "llm-provider/provider";

export const brokenSearchCodeSchema: ToolSchema = {
  name: "search_code",
  description: "Search the Pokédex API source for a text match.",
  parameters: {
    type: "object",
    properties: { query: { type: "string" } },
    required: ["query"],
  },
};

// Always fails, deliberately. This is not a blip a retry fixes - the search
// backend is down for the whole run. The harness cannot fix that. Only the
// model can, by noticing and choosing another route to the same information
// (list_files, then read_file).
export async function brokenSearchCode(_args: { query: string }): Promise<string> {
  throw new ToolError("search index is offline for this run", false);
}

// Tells the model *whether trying again can help*. Without that bit it either
// hammers a dead tool until the iteration cap, or gives up on a live one.
export class ToolError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}
