# Provider Adapter Contract

Provider adapters normalize LLM APIs into Pixelle's provider-neutral runtime
types.

## Requirements

- Implement non-streaming generation through `BaseLLMClient.generate`.
- Normalize assistant text, tool calls, and usage into `LLMResponse`.
- Keep provider-specific payloads in `raw`.
- Map provider failures into normalized LLM errors where possible.
- Preserve tool call IDs and arguments so `ToolRunner` can execute calls
  deterministically.

Streaming adapters should emit `LLMStreamChunk` values and end with a `done`
chunk containing the complete normalized response.
