# AI Agents Engineering Workshop

A hands-on workshop repo that teaches how a coding harness works, by progressively building two systems in parallel: an Engineering Agent the instructor builds in session (on a bundled sample codebase), and a Wiki Harness each attendee builds as homework (on a snapshot of the public QuestionPro help centre).

## Language

**Example**:
A folder under `examples/NN-name/` containing the code for one workshop stage. Each example's agent loop and tools are its own copy, duplicated on purpose so the logic that changes stage to stage stays independently readable. The provider/config layer is the one exception: it's shared via the `llm-provider` workspace package (see ADR-0003) since it's identical across every example and has no pedagogical reason to be duplicated.
_Avoid_: stage, step, module (when referring to a workshop folder)

**Fixture Repo**:
The tiny, deliberately-crafted sample codebase (with a known failing test) bundled inside the workshop and used as the target for the Engineering Agent's tools (search_code, read_file, list_files, run_tests, and from example 05 edit_file). Deterministic and identical for every attendee. Themed as a small "Pokédex API" service for memorability — the theme is narrative flavor only; the tools and skills exercised are unchanged plain engineering tools (real code, real tests, real git).
_Avoid_: sandbox, target project, test repo

**Engineering Agent**:
The single running agent instance built up progressively across the examples. Operates exclusively on the Fixture Repo, never on the workshop repo itself or an attendee's own project.

**Wiki Harness**:
The agent each attendee builds themselves under `harness/`, one stage per session, as homework. Operates exclusively on the Corpus. Upstream ships the scaffold and never edits `harness/src` again, so an attendee's fork never conflicts on a weekly `git pull upstream main`.
_Avoid_: student agent, homework agent, wiki bot

**Corpus**:
The committed offline snapshot under `harness/corpus/` — 162 markdown pages from the public QuestionPro help centre plus a `manifest.json`. Public content only, so no data-governance question arises; offline and committed, so homework needs no VPN, no wiki credentials, and yields identical results for every attendee. Regenerated only by `pnpm snapshot`, and never mid-workshop, because moving it invalidates the Golden Set.
_Avoid_: wiki dump, scrape, dataset

**Golden Set**:
The ten fixed questions in `harness/golden.json` with known answers, all verifiable against the Corpus. Attendees score their Wiki Harness against it after every session from session 2 on, averaging several runs because the model is not deterministic, and watch the number climb. Scored by whole-token match, so an expected "8" does not pass on "128". Never edited — a benchmark that moves measures nothing.
_Avoid_: eval set, test set, benchmark questions

**Verify**:
The offline structural check (`pnpm verify`, `scripts/verify.ts`) that tells an attendee whether this week's homework has the right shape. Makes no API calls, so it is free, fast, and deterministic. Reports `....` for stages not yet reached rather than failing them. Distinct from the Golden Set, which scores answers rather than structure.
_Avoid_: tests, grading, linting
