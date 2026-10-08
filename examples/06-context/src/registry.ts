import type { ToolSchema } from "llm-provider/provider";

// Every tool the runtime knows about is classified by what it's allowed to
// do. Example 09 (Security) uses this classification to decide what runs
// automatically versus what needs approval.
export type ToolKind = "read" | "write" | "execute";

export interface Tool {
  schema: ToolSchema;
  kind: ToolKind;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  run: (args: any) => Promise<string>;
}

export class ToolRegistry {
  private tools = new Map<string, Tool>();

  register(tool: Tool): void {
    this.tools.set(tool.schema.name, tool);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  schemas(): ToolSchema[] {
    return [...this.tools.values()].map((tool) => tool.schema);
  }
}
