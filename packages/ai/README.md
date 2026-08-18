# @kdp/ai

Provider-agnostic AI capability surface (§8/§9 of the brief). `AIProvider` is
implemented by `ClaudeAIProvider`, `OpenAIAIProvider`, and `MockAIProvider`
(the dev/test default — no network calls, deterministic). Domain methods
(`generateOutline`, `generateBookContent`, `editContent`, `analyzeContent`,
`generateMetadata`) live once in `BaseAIProvider`, built on top of each
provider's two primitives (`generateText`, `generateStructuredData`) — see
that file for why.

Select a provider via `createAIProvider(config)`, reading `AI_PROVIDER` from
`@kdp/config`. `AI_MODEL` overrides the provider's default model
(`claude-opus-5` / `gpt-5`).

Structured output uses each SDK's native schema-validated parse helper
(`messages.parse()` + `zodOutputFormat` for Claude, `chat.completions.parse()`
+ `zodResponseFormat` for OpenAI) rather than a hand-rolled JSON-in-prompt
convention.

`pricing.ts` holds a verified (not fabricated) USD-per-million-token table
used for AI usage cost estimation (§28) — update it if published rates
change; a future admin screen (Phase 11) makes this editable without a
code change.
