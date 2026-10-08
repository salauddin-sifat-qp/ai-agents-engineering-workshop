# Project memory

Facts about this project that are true across sessions. The harness pastes
this file into the system prompt on every run, so anything here costs tokens
on every single call — keep it short and keep it durable.

- This project uses vitest; run the suite with `npm test` from the project root.
- Source lives in `src/`, and every test file sits next to the file it tests.
- Pokémon names are matched case-insensitively.
