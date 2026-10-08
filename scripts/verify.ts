// Structural checks for your homework harness. No API calls, no model, no
// network - so it is fast, free, and deterministic. It tells you whether the
// thing you built has the right shape, not whether the model gave a good
// answer (that is `pnpm golden`).
//
//   pnpm verify
//
// Checks you have not reached yet report "...." (pending), not FAIL. Nothing
// here is graded; it exists so you can tell, alone at 1am, whether you are
// done with this week's homework.

import { execFileSync } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import path from "node:path";

type Status = "pass" | "fail" | "pending";

interface Result {
  session: number;
  name: string;
  status: Status;
  detail?: string;
}

const ROOT = path.resolve(import.meta.dirname, "..");
const HARNESS = path.join(ROOT, "harness");
const results: Result[] = [];

function record(session: number, name: string, status: Status, detail?: string): void {
  results.push({ session, name, status, detail });
}

function asMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function loadModule(relative: string): Promise<Record<string, unknown> | undefined> {
  const file = path.join(HARNESS, "src", relative);

  try {
    await access(file);
  } catch {
    return undefined;
  }

  try {
    return (await import(file)) as Record<string, unknown>;
  } catch (error) {
    record(0, `src/${relative} imports cleanly`, "fail", asMessage(error));
    return undefined;
  }
}

// --- session 0: the repo itself -------------------------------------------

try {
  const tracked = execFileSync("git", ["ls-files", ".env"], { cwd: ROOT, encoding: "utf-8" });
  const committed = tracked.trim().length > 0;
  record(
    0,
    ".env is not committed",
    committed ? "fail" : "pass",
    committed ? "Your API key is in git. Remove it from the index and rotate the key." : undefined,
  );
} catch {
  record(0, ".env is not committed", "pending", "git not available");
}

record(0, "corpus is intact", ...(await checkCorpus()));

async function checkCorpus(): Promise<[Status, string]> {
  let raw: string;

  try {
    raw = await readFile(path.join(HARNESS, "corpus/manifest.json"), "utf-8");
  } catch {
    return ["fail", "missing - run `git checkout -- harness/corpus`"];
  }

  try {
    const pages = (JSON.parse(raw) as { pages: unknown[] }).pages;
    return pages.length > 100
      ? ["pass", `${pages.length} pages`]
      : ["fail", `only ${pages.length} pages - run \`git checkout -- harness/corpus\``];
  } catch (error) {
    return ["fail", `manifest.json is not valid JSON (${asMessage(error)})`];
  }
}

// --- session 1: tools ------------------------------------------------------

const toolsModule = await loadModule("tools.ts");
const tools = toolsModule?.tools as
  | { schema?: { name?: string; description?: string }; kind?: string }[]
  | undefined;

if (Array.isArray(tools)) {
  record(1, "src/tools.ts exports `tools`", "pass", `${tools.length} tools`);

  const unnamed = tools.filter((tool) => !tool.schema?.name).length;
  record(
    1,
    "every tool has a schema with a name",
    unnamed === 0 ? "pass" : "fail",
    unnamed ? `${unnamed} tool(s) missing schema.name` : undefined,
  );

  const undescribed = tools.filter((tool) => (tool.schema?.description ?? "").length < 20).length;
  record(
    1,
    "every tool has a real description",
    undescribed === 0 ? "pass" : "fail",
    undescribed
      ? `${undescribed} tool(s) under 20 chars - the description IS the prompt`
      : undefined,
  );

  const unclassified = tools.filter(
    (tool) => !["read", "write", "execute"].includes(tool.kind ?? ""),
  ).length;
  record(
    3,
    "every tool is classified read/write/execute",
    unclassified === 0 ? "pass" : "fail",
    unclassified ? `${unclassified} tool(s) without a valid kind` : undefined,
  );
} else {
  record(1, "src/tools.ts exports `tools`", "pending", "export const tools = [...]");
}

// --- session 2: the loop ---------------------------------------------------

const agentModule = await loadModule("agent.ts");

record(
  2,
  "src/agent.ts exports `ask`",
  typeof agentModule?.ask === "function" ? "pass" : "pending",
  agentModule ? undefined : "needed by `pnpm golden`",
);

record(2, "the loop is bounded", ...checkIterationCap(agentModule?.MAX_ITERATIONS, agentModule));

function checkIterationCap(value: unknown, module: unknown): [Status, string] {
  if (typeof value === "number" && value > 0 && value <= 50) {
    return ["pass", `MAX_ITERATIONS = ${value}`];
  }
  if (!module) {
    return ["pending", "export a MAX_ITERATIONS constant from src/agent.ts"];
  }
  return ["fail", "export a MAX_ITERATIONS constant (1-50) from src/agent.ts"];
}

// --- session 3: the write tool --------------------------------------------

const editModule = await loadModule("edit.ts");
const editPage = editModule?.editPage as
  | ((args: Record<string, unknown>) => Promise<string>)
  | undefined;

if (typeof editPage === "function") {
  record(3, "src/edit.ts exports `editPage`", "pass");

  const unread = String(
    await editPage({
      slug: "audience-nested-quota",
      old_text: "Nested quota",
      new_text: "Nested quota",
    }).catch(asMessage),
  );
  const refused = /refus|read .* first|not read/i.test(unread);
  record(
    3,
    "editPage refuses a page it has not read",
    refused ? "pass" : "fail",
    refused ? undefined : `got: ${unread.slice(0, 80)}`,
  );

  const noMatch = String(
    await editPage({
      slug: "audience-nested-quota",
      old_text: "a string that is definitely not in this page anywhere at all",
      new_text: "x",
      dry_run: true,
    }).catch(asMessage),
  );
  const reported = /no match|not found|0 match/i.test(noMatch);
  record(
    3,
    "editPage reports a failed match instead of silently doing nothing",
    reported ? "pass" : "fail",
    reported ? undefined : `got: ${noMatch.slice(0, 80)}`,
  );
} else {
  record(3, "src/edit.ts exports `editPage`", "pending");
}

// --- session 3: context and sessions ---------------------------------------

const contextModule = await loadModule("context.ts");
const threshold = contextModule?.COMPACT_THRESHOLD_CHARS;

record(
  3,
  "compaction has a threshold (stretch)",
  typeof threshold === "number" && threshold > 0 ? "pass" : "pending",
  typeof threshold === "number" ? `${threshold} chars` : undefined,
);

record(
  3,
  "src/context.ts exports `compact` (stretch)",
  typeof contextModule?.compact === "function" ? "pass" : "pending",
);

const sessionModule = await loadModule("session.ts");
const save = sessionModule?.saveSession as ((messages: unknown[]) => Promise<void>) | undefined;
const load = sessionModule?.loadSession as (() => Promise<unknown[] | undefined>) | undefined;

if (typeof save === "function" && typeof load === "function") {
  const sample = [
    { role: "system", content: "verify" },
    { role: "user", content: "round trip" },
  ];

  // The round trip writes to YOUR session file. Put back whatever was there,
  // or running verify would wipe the session you were about to resume.
  const original = await load().catch(() => undefined);
  try {
    await save(sample);
    const restored = await load();
    const ok = restored?.length === sample.length;
    record(
      3,
      "sessions round-trip through disk (stretch)",
      ok ? "pass" : "fail",
      ok ? undefined : `saved ${sample.length}, loaded ${restored?.length ?? 0}`,
    );
  } catch (error) {
    record(3, "sessions round-trip through disk (stretch)", "fail", asMessage(error));
  } finally {
    if (original) await save(original).catch(() => undefined);
  }
} else {
  record(3, "sessions round-trip through disk (stretch)", "pending", "saveSession / loadSession");
}

// --- session 5: the policy hook ---------------------------------------------

const policyModule = await loadModule("policy.ts");
const beforeToolCall = policyModule?.beforeToolCall as
  | ((tool: unknown, args: unknown) => Promise<{ allow?: boolean }>)
  | undefined;

if (typeof beforeToolCall === "function") {
  record(5, "src/policy.ts exports `beforeToolCall`", "pass");

  // Only a read is exercised: a write or execute would wait on a human.
  const readTool = { schema: { name: "search_docs" }, kind: "read", run: async () => "" };
  const decision = await beforeToolCall(readTool, { query: "quota" }).catch(() => undefined);
  record(
    5,
    "a read tool runs without asking",
    decision?.allow === true ? "pass" : "fail",
    decision?.allow === true ? undefined : `got: ${JSON.stringify(decision)}`,
  );
} else {
  record(5, "src/policy.ts exports `beforeToolCall`", "pending");
}

// --- report ----------------------------------------------------------------

const label: Record<Status, string> = { pass: "PASS", fail: "FAIL", pending: "...." };
let currentSession = -1;

for (const result of results.sort((a, b) => a.session - b.session)) {
  if (result.session !== currentSession) {
    currentSession = result.session;
    console.log(`\n${currentSession === 0 ? "setup" : `session ${currentSession}`}`);
  }
  console.log(
    `  ${label[result.status]}  ${result.name}${result.detail ? `  (${result.detail})` : ""}`,
  );
}

const failed = results.filter((result) => result.status === "fail").length;
const passed = results.filter((result) => result.status === "pass").length;
const pending = results.filter((result) => result.status === "pending").length;

console.log(`\n${passed} passed, ${failed} failed, ${pending} not built yet`);
process.exit(failed > 0 ? 1 : 0);
