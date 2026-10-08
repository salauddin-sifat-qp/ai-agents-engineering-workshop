# 05 - Tools and Edit

Two lessons, one folder: what makes a tool good, and why the write tool is
the hardest one in any coding harness.

## 1. Tool design

```bash
pnpm 05
```

Prints one bad tool next to the good ones.

`execute_anything(input: string)` (`badTool.ts`) takes one opaque string and
shells out to `sh -c`. It can't be classified as read/write/execute, can't
be validated, and its log line tells a reviewer nothing.

The good tools (`tools.ts`) are narrow, typed, and each declared with a
`ToolKind` (`read`/`write`/`execute`) in a `ToolRegistry` - the
classification Example 09 builds its policy hook on.

The name and description are prompt: the model reads them on every call to
decide which tool to use. Every coding harness still ships a shell, and that
is the point - Bash is the one generic tool, so nothing else has to be. pi
ships four tools (`read`, `bash`, `edit`, `write`) and keeps the prompt
small; Claude Code ships many dedicated ones so each can be controlled on its
own. Neither ships a second `execute_anything`.

## 2. The write tool - run both versions

```bash
pnpm 05:naive     # write_file(path, content) - whole-file rewrite
git diff examples/05-tools-and-edit/src/fixture
pnpm --filter 05-tools-and-edit reset
```

`write_file` is what everyone builds first. The model regenerates the entire
file from what it has seen. `read_file` truncates at 4,000 characters and
`pokedex.ts` is about 5,800, so the model never saw the end of the file - and
`write_file` saves only what it reproduced. The tests don't cover the lost
functions, so they can pass anyway. It cannot be reviewed, because "ok" is
the only thing it reports.

```bash
pnpm 05:edit      # edit_file(path, old_text, new_text)
git diff examples/05-tools-and-edit/src/fixture
pnpm --filter 05-tools-and-edit reset
```

`edit_file` replaces one exact snippet, and enforces four rules.

| Rule                                      | Failure it prevents                                              |
| ----------------------------------------- | ---------------------------------------------------------------- |
| **Read before write**                     | Editing a remembered version of the file instead of the real one |
| **Exactly one match**                     | Silently editing the wrong occurrence                            |
| **Zero matches is an error, not a no-op** | The agent believing an edit landed when it did not               |
| **Return a diff**                         | A human being unable to review what changed                      |

Each failure returns a _different_ message. A model only recovers from a
failure it can tell apart — `edit failed` makes it retry the identical call
until the iteration budget runs out.

`old_text` is replaced with a replacer function, not a replacement string:
`String.replace` treats `$&` and `$$` in a string as patterns, and code is
full of dollar signs.

## What a production edit tool adds

pi's `edit` tool does all of the above, plus: it normalises CRLF line endings
before matching and restores them on write, strips an invisible BOM, falls
back to a fuzzy match (trailing whitespace, smart quotes, Unicode dashes) when
the exact match fails, applies several edits in one call against the original
file, and queues parallel edits to the same file. Real harnesses also refuse
the edit if the file changed on disk since it was read. None of that is
implemented here; each is a bug someone hit in production.

## Where enforcement lives

Read-before-write is tracked by the runtime (`filesRead` in `editTool.ts`,
populated from the loop in `agent.ts`), not by asking the model nicely in the
system prompt. The prompt states the workflow so the model cooperates; the
code enforces it so it cannot do otherwise.

## Run

```bash
pnpm 05
pnpm --filter 05-tools-and-edit test:fixture   # confirm the test fails first
pnpm 05:naive && pnpm --filter 05-tools-and-edit reset
pnpm 05:edit
pnpm --filter 05-tools-and-edit test:fixture   # ...and passes after
pnpm --filter 05-tools-and-edit reset          # restore the fixture
```
