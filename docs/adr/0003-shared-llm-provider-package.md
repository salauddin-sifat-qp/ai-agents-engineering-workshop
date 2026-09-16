# Shared llm-provider package instead of per-example duplication

Every example's `config.ts` and `provider.ts` were byte-for-byte copies (per
ADR-0001), duplicated across all 12 examples. That stopped being free the
moment the provider layer needed a real fix: switching the documented
default from Groq to Gemini, then patching Gemini's `thought_signature`
round-trip behavior, meant editing the same logic in 12 places and hoping
none were missed. We extracted `config.ts` and `provider.ts` into a pnpm
workspace package, `packages/llm-provider`, imported as `llm-provider/config`
and `llm-provider/provider`.

This reverses part of ADR-0001: examples are no longer fully standalone,
they now depend on a workspace package and can't be copied out of the repo
in isolation without also copying `packages/llm-provider`. We accept that
cost specifically for the provider/config layer, because it's the one piece
every example shares identically and has no pedagogical reason to duplicate.
The agent loop and tools are different: they intentionally diverge example
to example as the workshop progresses, so those stay duplicated on purpose.
