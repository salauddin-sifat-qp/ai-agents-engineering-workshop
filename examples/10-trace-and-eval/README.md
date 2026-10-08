# 10 - Trace and Eval

A trace and an eval are the same file read two ways.

## Trace (`tracer.ts`, `tracedAgent.ts`)

One JSON line per LLM call and per tool call - model, tokens, duration, tool
name, arguments, whether it succeeded, a preview of the result - plus one
`run_end` line with totals. Each line goes to the terminal and to
`.traces/<run>.jsonl`.

```text
Agent Run
 |- llm_call    { model, promptTokens, completionTokens, finishReason, durationMs }
 |- tool_call   { name, args, ok, resultChars, resultPreview, durationMs }
 |- llm_call
 |- run_end     { iterations, finished, promptTokens, completionTokens, durationMs }
```

Tokens come from the provider's `usage` field, not an estimate. No platform,
no dashboard: JSONL is enough to reconstruct exactly what a run did, and it
is the same format your own tool's session files use.

## Eval (`eval.ts`, `score.ts`, `dataset.json`)

Runs each task in `dataset.json` with tracing on, then scores the **trace
file**, not the agent's return value: did it call the expected tools, did it
finish inside the iteration budget. Rule-based, no second LLM call.

Agents have many valid paths to a correct answer, so this scores the path.
It measures process, not correctness: an agent can call every right tool and
still conclude wrong - or take a different right path and fail the rule. The
harness's `golden.json` is the other half: it scores the answer.

## Run

```bash
pnpm --filter 10-trace-and-eval test:fixture
pnpm 10         # one traced run
pnpm 10:eval    # score the dataset from the traces
```
