# 08 - Sub-Agent

`spawnAgent({ task, tools })` runs a real, independent agent loop - its own
message history, its own iteration budget, only the tools its task needs.
The parent agent never sees its intermediate tool calls, only the final
result it reports back.

Delegation is a tool call. The parent agent gets a `delegate` tool and
cannot read code itself, so it has to decide to delegate and write the brief.
That is the shape of Claude Code's Task tool. The run prints each brief and
how many characters came back - that report is all the parent pays for.

This is isolation, not simulation: the sub-agent costs real LLM calls and
can fail or time out on its own, independently of the parent.

## Run

```bash
pnpm --filter 08-sub-agent test:fixture
pnpm --filter 08-sub-agent start
```
