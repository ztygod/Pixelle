# Plugin Development

The first stable plugin boundary is the Tool API. Provider adapters and
middleware are also supported extension points, but should depend only on
documented public exports.

## Guidelines

- Register tools through `ToolRegistry`.
- Use Zod schemas for every tool input.
- Check permissions before side effects.
- Return structured `ToolResult` values for expected failures.
- Avoid depending on internal runtime implementation files.

Plugins should include contract tests for schema validation, permission
handling, error results, and abort behavior.
