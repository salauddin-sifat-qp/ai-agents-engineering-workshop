import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

// A trace is one JSON line per LLM call or tool call, with enough detail to
// reconstruct the whole run afterwards. Same format as a session file: JSONL,
// appended, never rewritten. No platform to integrate - just discipline about
// what gets logged.
export type TraceEvent =
  | {
      type: "llm_call";
      model: string;
      durationMs: number;
      promptTokens?: number;
      completionTokens?: number;
      finishReason?: string;
    }
  | {
      type: "tool_call";
      name: string;
      args: unknown;
      durationMs: number;
      ok: boolean;
      resultChars: number;
      // Enough to see what the model was shown; the full result can be huge.
      resultPreview: string;
    }
  | {
      type: "run_end";
      iterations: number;
      // Did the model stop on its own with an answer? Iteration count can't
      // tell: answering on the last allowed call and being cut off look alike.
      finished: boolean;
      durationMs: number;
      promptTokens: number;
      completionTokens: number;
    };

export const TRACE_DIR = path.resolve(import.meta.dirname, "../.traces");

export type Tracer = (event: TraceEvent) => void;

// Each event goes to the terminal and to the run's trace file. The terminal
// is for watching; the file is what evaluation reads.
export function createTracer(file: string, echo = true): Tracer {
  mkdirSync(path.dirname(file), { recursive: true });
  return (event) => {
    const line = JSON.stringify({ timestamp: new Date().toISOString(), ...event });
    if (echo) console.log(line);
    appendFileSync(file, `${line}\n`, "utf-8");
  };
}

export function readTrace(file: string): TraceEvent[] {
  return readFileSync(file, "utf-8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as TraceEvent);
}

export async function timed<T>(fn: () => Promise<T>): Promise<{ result: T; durationMs: number }> {
  const start = performance.now();
  const result = await fn();
  return { result, durationMs: Math.round(performance.now() - start) };
}
