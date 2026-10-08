# AI Agents Engineering Workshop

Five sessions on how a coding harness actually works — Claude Code, Codex, pi,
opencode. Provider, system prompt, tools, the loop, the write tool, context
and memory, protocols, delegation, policy, reliability, evaluation.

Two tracks running in parallel:

- **`examples/`** — the instructor builds an **Engineering Agent** that
  investigates and fixes a bundled Pokédex API fixture with one deliberately
  failing test.
- **`harness/`** — you build a **QuestionPro Wiki Harness** over an offline
  snapshot of the public help centre, one stage per week, as homework.

## Prerequisites

- Node.js 20+
- pnpm (`corepack enable`)
- Your own LLM API key (one per person, never shared)

## Setup

```bash
git clone <your fork>
cd ai-agents-engineering-workshop
git remote add upstream https://github.com/salauddin-sifat-qp/ai-agents-engineering-workshop.git
pnpm install
cp .env.example .env    # then paste your key in
```

Start every session with `git pull upstream main`. Upstream only touches
`examples/`, `packages/` and docs; you only touch `harness/`. No conflicts.

## Configure a provider

```env
LLM_API_KEY=
LLM_BASE_URL=
LLM_MODEL=
```

Default: **[Google Gemini](https://aistudio.google.com/apikey)** free tier,
already filled in `.env.example`. Any OpenAI-compatible endpoint with tool
calling works.

**Each participant needs their own key.** The free tier is rate-limited per
key, so one shared key across a room fails immediately. The provider retries
429s automatically (`packages/llm-provider/src/provider.ts`) — you will still
see them, it will still recover.

Use a personal Google account; corporate Workspace accounts often block AI
Studio. `.env` is gitignored, and a fork of a public repo is public.

## Run an example

```bash
pnpm 01          # shorthand for: pnpm --filter 01-basic-llm start
```

See exactly what goes over the wire - every request re-sends the whole
history, because the API keeps nothing between calls:

```bash
LLM_DEBUG=1 pnpm 02
```

The fixture ships with a failing test. Confirm it before running the agent:

```bash
pnpm --filter 03-agent-loop test:fixture
pnpm 03
```

Examples with more than one entry point:

```bash
pnpm 05            # bad tool vs narrow tools
pnpm 05:naive      # write_file - the bad write tool, run this first
pnpm 05:edit       # edit_file  - the good one
pnpm 06            # compaction + memory + session persistence
pnpm 06:resume
pnpm 06:fork <id>  # continue from an earlier session entry
pnpm 07            # MCP against a real external server
pnpm 07:server     # MCP over stdio, our own server
pnpm 07:connect    # connect our server to pi or Claude Code
pnpm 09            # prompt-injection defence + approval hook
pnpm 09:unguarded  # approval hook only, the baseline
pnpm 09:errors     # structured tool errors: search is offline
pnpm 10            # one traced run, written to .traces/
pnpm 10:eval       # score a dataset from its traces
```

Examples 05 and 06 write to their fixture. Undo with:

```bash
pnpm --filter 05-tools-and-edit reset
pnpm --filter 06-context reset   # also deletes the saved session
```

## Homework

```bash
pnpm harness     # run your own harness
pnpm verify      # structural checks, offline and free
pnpm golden      # score against 10 fixed questions (from session 2)
pnpm golden --runs=3  # the model is not deterministic: average 3 runs
```

Assignments and success criteria: [`harness/README.md`](harness/README.md)

## Progression

| #   | Example         | Concept                                                              | Session |
| --- | --------------- | -------------------------------------------------------------------- | ------- |
| 01  | `basic-llm`     | `User -> LLM -> Response`; the provider interface; the system prompt | 1       |
| 02  | `tool-calling`  | The model requests, the application executes                         | 1       |
| 03  | `agent-loop`    | Observe -> decide -> act -> repeat, with `MAX_ITERATIONS`            | 2       |
| 04  | `state`         | History vs. agent state; truncation; tokens per call from `usage`    | 2       |
| 05  | `tools-and-edit`  | Narrow tools vs. `execute_anything`; `write_file` vs. `edit_file`    | 3       |
| 06  | `context`         | Compaction; session JSONL with resume and fork; `AGENTS.md` memory   | 3       |
| 07  | `mcp`             | Consume a real server; write your own; connect it to your own tool   | 4       |
| 08  | `sub-agent`       | A `delegate` tool: nested loop, isolated context (Claude's Task)     | 4       |
| 09  | `policy`          | Pre-tool hook, approval, prompt injection, structured tool errors    | 5       |
| 10  | `trace-and-eval`  | JSONL trace of every call; trajectory eval scored from the trace     | 5       |

## Maintainer

Regenerate the corpus (instructor only, and not mid-workshop — it invalidates
`golden.json`):

```bash
pnpm snapshot
```

## Glossary

[`CONTEXT.md`](CONTEXT.md)
