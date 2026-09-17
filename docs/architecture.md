# Production Architecture

```text
                    User
                      |
                      v
               Application API
                      |
                      v
                 Agent Runtime
                      |
        +-------------+-------------+
        v             v             v
      Model         State         Policy
        |
        v
     Tool Layer
        |
   +----+----+
   v    v    v
  MCP  APIs  DB
        |
        v
   External Systems

        +
   Observability
        +
    Evaluation
        +
      Security
```

## Where things live

**Agent Runtime** - owns the loop (Example 03): call the model, execute
what it asks for, feed the result back. Everything else in this document
is something the runtime coordinates, not something it does itself.

**Model** - stateless. Given the same messages and tools, it returns a
response. All memory of a run lives in the messages the runtime sends it,
not in the model.

**State** (Examples 04, 07) - split into conversation history (what the
model sees, costs tokens) and agent state (iteration counts, budgets,
which files have been read - never sent to the model). Two production
concerns sit here. **Compaction**: the history only grows, so at a
threshold the runtime summarises the oldest middle section and continues,
rather than truncating and losing the tail. **Persistence**: the
transcript is written after every turn, so a run survives a crash and can
be resumed or replayed. Longer-lived state (project memory, prior run
summaries) is usually a file or a database the runtime loads into the
system prompt before the first call.

**Policy** (Example 11) - decides what a tool call is allowed to do before
it runs: automatic, needs approval, or blocked. Sits between the runtime
and the tool layer, not inside individual tools - so the policy can change
without touching tool code. Permission modes in production harnesses
(auto-accept, plan mode, sandboxed execution, path allowlists) are this
table with a user interface on top.

**Tool Layer** (Examples 02, 05, 06) - the boundary where the model's
intent becomes a real side effect. Tools are narrow, typed, and classified
(read/write/execute) so the policy layer has something to act on. The
write tool is the hard one: it enforces read-before-write, requires an
exactly-once match, treats a failed match as an error rather than a
no-op, and returns a diff. Those rules live in the runtime, not the
prompt - a prompt shapes a tendency, code sets a limit.

**Retry** - two mechanisms, deliberately separate. Transport retry
(429, 5xx, timeouts) lives in the provider, is handled deterministically,
and never enters the conversation, because a rate limit carries nothing
the model can act on. Semantic retry (Example 12) hands a structured
`{ ok, error }` back to the model so it can change strategy.

**MCP** (Example 08) - one way tools reach the tool layer: instead of the
runtime importing every integration directly, it speaks one protocol to
any number of MCP servers. Not the only way tools are exposed - plain
function calls and direct API clients still work - but the option to
decouple runtime from implementation when a tool is shared, remote, or
third-party. In practice a harness is the client far more often than the
server.

**Sub-agents and multi-agent** (Examples 09, 10) - a way of structuring
the Model + Tool Layer relationship, not a separate box in this diagram.
A sub-agent is a full runtime instance, called from inside a tool, with an
isolated context: it can spend thirty turns and return three sentences,
and the parent only pays for the three sentences.

**Observability** (Example 13) - every LLM call and tool call the runtime
makes gets traced. This is what makes "why did the agent do that"
answerable after the fact.

**Evaluation** (Example 14) - runs the same runtime against a fixed
dataset of tasks and scores the trajectory, not just the final answer.
What tells you a change to the runtime, tools, or prompt made things
better or worse. Trajectory scoring measures process; a golden question
set measures correctness. Each is blind to what the other catches.

**Security** (Example 11) - not a layer so much as a property of every
other layer: least-privilege tools, a policy that gates dangerous calls,
and treating tool output as untrusted content the model might be
manipulated by (indirect prompt injection). The system prompt's priority
over tool content is a tendency, not a guarantee, which is why the
approval gate exists underneath it.

## Final mental model

```text
The model provides intelligence; the runtime provides agency.
The tools provide capabilities; protocols provide interoperability;
state provides continuity; policies provide control;
evaluation provides confidence.
```
