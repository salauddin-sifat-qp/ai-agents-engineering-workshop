# Standalone, self-contained examples over a shared src/

> **Superseded by [ADR-0003](./0003-shared-llm-provider-package.md).** The
> provider/config layer specifically moved to a shared `packages/llm-provider`
> package once maintaining it identically across 12 copies became the actual
> cost. The reasoning below still holds for everything else in an example
> (agent loop, tools, tests) - only the provider/config layer was extracted.

Each `examples/NN-*/` folder duplicates whatever code it needs (provider client, types, agent loop) instead of importing from a shared `src/`. We considered a shared `src/` with thin per-example entry points, but rejected it: once `src/` accumulates later-stage code, an earlier example folder is no longer runnable in isolation, which breaks the PRD requirement that each example be understandable independently. We accept the duplication cost. Managed as a pnpm workspace so a single root `pnpm install` still covers every example.
