# Tool API

Tools are the extension boundary for actions the runtime can perform.

## Stable Contract

- `Tool.definition.name` is the stable identifier sent to LLM providers.
- `Tool.definition.parameters` is a Zod schema and is validated by
  `ToolRunner` before execution.
- `Tool.execute(input, context)` returns a `ToolResult` and should not throw
  for expected user or environment errors.
- `ToolContext.permissions` must be checked before file, network, or shell
  access.
- `ToolContext.signal` should be respected by long-running work.

## Result Shape

Successful tools return:

```ts
{ok: true, message: string, data: unknown}
```

Failed tools return:

```ts
{ok: false, message: string, code: string, data?: unknown}
```

Built-in error codes should remain stable. Third-party tools should namespace
custom codes to avoid collisions.
