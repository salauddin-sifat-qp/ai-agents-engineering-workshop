import { randomUUID } from "node:crypto";
import { appendFile, mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import type { ChatMessage } from "llm-provider/provider";

const SESSION_DIR = path.resolve(import.meta.dirname, "../.session");
const SESSION_FILE = path.join(SESSION_DIR, "transcript.jsonl");

// One JSON object per line, appended as the run goes and never rewritten.
// Claude Code, Codex and pi all persist sessions in some variant of this
// format, for the same three reasons: you can resume after a crash, you can
// replay a run to debug it, and appending is cheap and cannot corrupt what
// was already written.
//
// Compaction is an entry too, not an overwrite. The full history stays on
// disk for debugging; the compaction entry tells a resume where the live
// context restarts.
//
// Every entry points at its parent, so the log is a tree, not a list - the
// same shape as pi's session files. Forking from an earlier entry just appends
// entries with an older parent; the branch you left stays on disk.
type SessionEntry = { id: string; parentId: string | null } & (
  | { type: "message"; message: ChatMessage }
  | { type: "compaction"; context: ChatMessage[] }
);

// The entry new appends hang off. Moves forward on every append; a resume or
// fork points it at the entry the run continues from.
let leafId: string | null = null;

// A fresh run starts a fresh log; a resumed run keeps appending to the old one.
export async function startSession(messages: ChatMessage[]): Promise<void> {
  await rm(SESSION_FILE, { force: true });
  leafId = null;
  for (const message of messages) await appendMessage(message);
}

export async function appendMessage(message: ChatMessage): Promise<void> {
  await append({ type: "message", message });
}

export async function appendCompaction(context: ChatMessage[]): Promise<void> {
  await append({ type: "compaction", context });
}

type NewEntry =
  | { type: "message"; message: ChatMessage }
  | { type: "compaction"; context: ChatMessage[] };

async function append(entry: NewEntry): Promise<void> {
  const id = randomUUID().slice(0, 8);
  await mkdir(SESSION_DIR, { recursive: true });
  await appendFile(SESSION_FILE, `${JSON.stringify({ id, parentId: leafId, ...entry })}\n`, "utf-8");
  leafId = id;
}

async function readEntries(): Promise<SessionEntry[] | undefined> {
  let raw: string;
  try {
    raw = await readFile(SESSION_FILE, "utf-8");
  } catch {
    return undefined;
  }
  const entries: SessionEntry[] = [];
  for (const line of raw.split("\n")) {
    if (!line) continue;
    try {
      entries.push(JSON.parse(line) as SessionEntry);
    } catch {
      // A crash mid-write leaves at most one torn last line. Skip it.
    }
  }
  return entries;
}

// Replays one branch: walk from the chosen entry (default: the last one
// written) up through its parents, then apply root to leaf. Messages
// accumulate; a compaction replaces everything before it.
export async function loadSession(fromId?: string): Promise<ChatMessage[] | undefined> {
  const entries = await readEntries();
  if (!entries?.length) return undefined;

  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const start = fromId ? byId.get(fromId) : entries.at(-1);
  if (!start) throw new Error(`No entry ${fromId} in ${SESSION_FILE}`);

  const branch: SessionEntry[] = [];
  for (let entry: SessionEntry | undefined = start; entry; ) {
    branch.unshift(entry);
    entry = entry.parentId ? byId.get(entry.parentId) : undefined;
  }
  const kept = dropUnansweredCall(branch);
  // New entries hang off the last kept entry, so a dropped call stays a dead
  // end on disk instead of reappearing in the middle of the resumed branch.
  leafId = kept.at(-1)?.id ?? null;

  let context: ChatMessage[] = [];
  for (const entry of kept) {
    if (entry.type === "message") context.push(entry.message);
    else context = [...entry.context];
  }

  return context.length > 0 ? context : undefined;
}

// Ctrl-C between a tool call and its result leaves a call with no answer.
// Sending that back is an orphan the provider rejects, so drop the call and
// let the resumed run ask the model again.
function dropUnansweredCall(branch: SessionEntry[]): SessionEntry[] {
  for (let i = branch.length - 1; i >= 0; i--) {
    const entry = branch[i];
    if (entry?.type !== "message") return branch;
    const { message } = entry;
    if (message.role !== "assistant" || !message.toolCalls?.length) continue;

    const answered = branch
      .slice(i + 1)
      .filter((next) => next.type === "message" && next.message.role === "tool").length;
    return answered < message.toolCalls.length ? branch.slice(0, i) : branch;
  }
  return branch;
}

export const sessionPath = SESSION_FILE;
