# Homework: build the QuestionPro Wiki Harness

Across five sessions you build your own harness in this folder. The instructor
builds the same ideas against a buggy Pokédex API in `examples/`; you build
them against the QuestionPro help centre.

**You only ever edit files under `harness/`.** Upstream never touches
`harness/src`, so `git pull upstream main` stays conflict-free all five weeks.

## The corpus

`harness/corpus/` is an offline snapshot of 162 public pages from
<https://www.questionpro.com/help>, captured as markdown.

Offline and committed, on purpose: no VPN, no wiki API key, no rate limits, no
internal data leaving your machine, and byte-identical results for everyone in
the room. `src/wikiClient.ts` is pre-built and reads it. **That file is
plumbing, not the lesson — do not rewrite it.**

## Two ways to know you are done

```bash
pnpm verify     # structure: does what you built have the right shape? (offline, free)
pnpm golden     # score: 10 fixed questions with known answers
```

`pnpm verify` reports `....` for checks you have not reached yet, so run it any
time. `pnpm golden` needs an `ask()` function, so it starts working in session 2.

Your first golden score, in week 2, is the baseline you beat for the rest of
the course. **Never edit `golden.json`** — a benchmark you move is not a
benchmark. The model is not deterministic, so one run is one sample: compare
weeks with `pnpm golden --runs=3`, not single runs.

## Ground rules

- Timebox yourself to 90 minutes. If you are stuck past that, stop and bring
  the stuck thing to the session. Being stuck is data.
- You are paired. Ask your pair before you ask the instructor.
- You are never blocked: `examples/` has a working reference for every stage.
  Copying it will not complete the assignment, because your tools, your
  corpus, and your `pnpm verify` checks are different. Adapt, don't paste.
- `.env` is gitignored. Your fork of a public repo is public. `pnpm verify`
  fails loudly if `.env` is ever committed. It cannot see a key you pasted
  into another file, so don't.
- At the top of each session, somebody demos their harness and explains their
  own code. Assume it will be you.

---

## Session 1 — provider, system prompt, one tool

Right now `src/index.ts` calls the model once and hands it search results in
the prompt. That is not an agent. Make the model _ask_ for the search instead.

Build `src/tools.ts` exporting a `tools` array. Start with one:

```ts
export const tools = [{ schema: searchDocsSchema, kind: "read", run: searchDocs }];
```

Then make one tool call execute end to end, the way `examples/02-tool-calling`
does: model requests, you execute, you hand the result back.

The model may ask for more than one tool call in a single response. Answer
every one, each with its own `toolCallId`.

Run it once with `LLM_DEBUG=1 pnpm harness` and read the request body. That
is everything the model knows.

**Done when:** `pnpm verify` passes the session 1 checks; one tool call
executes; the answer changes depending on what search returned.

If you see `rate limited (429), retrying in Ns`, that is the shared provider
recovering on its own. Do not work around it; screenshot it. Session 2 is
about why it exists, and next week's loop makes many more calls.

## Session 2 — the loop, retries, cost

Build `src/agent.ts`:

```ts
export const MAX_ITERATIONS = 10;
export async function ask(question: string): Promise<string>;
```

Add `read_page` to your tools. Wire the loop: model → tool → result → model,
until it stops asking for tools or hits the cap.

Print tokens and a cost estimate per run. Every `provider.chat()` response
carries `usage` (`promptTokens`, `completionTokens`) - sum them, don't
estimate from characters. You cannot manage what you do not measure, and the
number will surprise you.

If `finishReason` is `"length"`, the answer was cut off. Don't return it as if
it were complete.

**Done when:** `pnpm golden` runs and gives you a baseline score; a 429
recovers visibly instead of crashing; every run prints its own cost.

**In your own tool.** Do one real task at work with the coding agent you use
daily (Claude Code, Codex, pi, or similar). Open its transcript or usage view
and write down three numbers: loop iterations, tool calls, and tokens. Note
which tool calls were reads and which were writes. Bring the numbers to
session 4.

> **This week (handed out in session 3):** do session 2 first, then
> session 3's `editPage`. The edit tool is only useful once the loop exists,
> and `pnpm golden` needs `ask()`. Sessions and compaction below are
> stretch goals this week.

## Session 3 — the write tool, context and sessions

Build `src/edit.ts`:

```ts
export async function editPage(args: {
  slug: string;
  old_text: string;
  new_text: string;
  dry_run?: boolean;
}): Promise<string>;
```

Four rules, all enforced in code, none merely requested in the prompt:

1. Refuse a page the agent has not read this session.
2. `old_text` must match **exactly once** — zero and many are different errors.
3. A failed match is an error, never a silent no-op.
4. Return a diff, not `"ok"`.

One trap: `content.replace(old, new)` treats `$&` and `$$` in `new` as
patterns. Pass a function, `content.replace(old, () => new)`.

Stretch: refuse the edit if the page changed on disk since it was read.

Classify every tool `read` / `write` / `execute`.

### Stretch: sessions

Build `src/session.ts` (`saveSession`, `loadSession`). Persist the
transcript as JSONL after **every** turn, then add `--resume`. Appending one
line per message is better than rewriting the file: a crash can then only
lose the last line. `pnpm verify` round-trips `saveSession` / `loadSession`
through disk and puts your real session back afterwards.

**Done when:** `pnpm verify` passes the `editPage` checks; `git diff
harness/corpus` shows a clean, minimal patch (reset with `pnpm --filter
harness reset`). Stretch done when `--resume` picks up mid-task after a
Ctrl-C.

**Stretch.** Compaction in `src/context.ts` (`COMPACT_THRESHOLD_CHARS`,
`compact`): keep the system prompt, the task and the recent turns verbatim,
summarise the middle, never cut between a tool call and its results.
A `MEMORY.md` loaded into the system prompt at startup.

**In your own tool.**

1. Write a permission config for one real work repo. In Claude Code that is
   `permissions.allow` and `permissions.deny` in `.claude/settings.json`;
   other tools have an equivalent. At least three allow rules (test, lint,
   read-only git) and three deny rules (`.env` and secrets, `git push`,
   `rm -rf`), each with a one-line reason.
2. Open one of its session files (pi: `~/.pi/agent/sessions/`). Find the
   tool calls and any compaction entry.
3. For a week, start a fresh session per task and read every diff before
   accepting it. Compare token counts with the numbers from session 2's
   own-tool task.

Bring one permission rule you had to change, and why.

## Session 4 — MCP

Expose your harness's tools as an MCP server over stdio.

Then connect a real harness to it — Claude Code, pi, Codex, whichever you use
— and drive your QuestionPro wiki tools from it.

Mark each tool with MCP annotations (`readOnlyHint: true` for search and read,
`destructiveHint: true` for edit). The client you connect uses them to decide
what needs approval - the same read/write/execute tag from session 3.
`examples/07-mcp` has both: annotations in `mcpServer.ts`, and `pnpm
07:connect` prints the commands to connect a server to pi or Claude Code.

**Done when:** a coding agent you did not write is searching the QuestionPro
help centre through a server you did write. Screenshot it. This is the week
that makes the other four worth it.

**Stretch.** A `delegate` tool that hands a research question to a sub-agent
with only the read tools (`examples/08-sub-agent`).

**In your own tool.** Connect one real MCP server you would use at work
(GitHub, your issue tracker, a read-only database). Check which of its tools
are read-only, and only auto-approve those.

## Session 5 — make it survivable, then demo

Build `src/policy.ts` exporting a pre-tool hook:

```ts
export async function beforeToolCall(
  tool: Tool,
  args: unknown,
): Promise<{ allow: true } | { allow: false; reason: string }>;
```

Call it before every tool call. `read` runs automatically; `write` and
`execute` ask a human. A denial goes back to the model as a structured
result (`{ ok: false, error, retryable }`), not a crash.
`examples/09-policy` is the reference.

Then plant a poisoned page in your corpus — an instruction hidden in a help
article telling the agent to ignore its rules — and show what your harness
does about it. Run it twice, with and without your system-prompt defence,
and make sure the question you ask actually leads the agent to that page.
`pnpm verify` checks the hook's export and that a read runs without asking;
the demo is the real check.

**Stretch.** One JSON trace line per LLM and tool call, written to a file
(`examples/10-trace-and-eval`).

**In your own tool.** Write one hook in the agent you use daily: for
example, run the linter after every edit, or block any command that touches
`.env`. It is the same pre-tool idea, in a tool you did not write.

**Done when:** `pnpm verify` is all green, `pnpm golden --runs=3` is your
best average of the five weeks, and you can demo the injection being
contained.

---

## Reference map

| Your session | Reference example                                                              |
| ------------ | ------------------------------------------------------------------------------ |
| 1            | `examples/01-basic-llm`, `examples/02-tool-calling`                            |
| 2            | `examples/03-agent-loop`, `examples/04-state`, `packages/llm-provider` (retry) |
| 3            | `examples/05-tools-and-edit`, `examples/06-context`                            |
| 4            | `examples/07-mcp`, `examples/08-sub-agent`                                     |
| 5            | `examples/09-policy`, `examples/10-trace-and-eval`                             |
