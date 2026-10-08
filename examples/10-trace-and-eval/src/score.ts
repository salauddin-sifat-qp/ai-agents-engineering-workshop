import type { TraceEvent } from "./tracer.ts";

export interface EvalTask {
  task: string;
  expectedTools: string[];
  maxIterations: number;
}

export interface EvalResult {
  task: string;
  pass: boolean;
  trajectory: string[];
  reasons: string[];
}

// Rule-based scoring, read straight off the trace: no second LLM call, no
// judgment calls - just checks on the trajectory that either hold or don't.
// Cheap, deterministic, reproducible. The trace you write for debugging is
// the same file the eval scores; that is why the two live together.
export function score(task: EvalTask, trace: TraceEvent[]): EvalResult {
  const trajectory = trace.flatMap((event) => (event.type === "tool_call" ? [event.name] : []));
  const end = trace.find((event) => event.type === "run_end");
  const reasons: string[] = [];

  const missingTools = task.expectedTools.filter((tool) => !trajectory.includes(tool));
  if (missingTools.length > 0) {
    reasons.push(`Never called expected tool(s): ${missingTools.join(", ")}`);
  }

  if (!end?.finished) {
    reasons.push(`No final answer within ${task.maxIterations} iterations`);
  }

  return { task: task.task, pass: reasons.length === 0, trajectory, reasons };
}
