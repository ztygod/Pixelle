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

## `web_fetch`

`web_fetch` reads text from a caller-provided HTTP or HTTPS URL. It only works
when `ToolContext.permissions.network` is granted. It is not a search, page
discovery, crawler, recursive fetch, or sitemap tool; callers must already know
the exact URL.

Input:

```ts
{
  reason: string;
  url: string;
  maxLength?: number; // default 20_000, max 200_000
  timeoutMs?: number; // default 15_000, max 60_000
}
```

Successful responses include HTTP metadata and capped text:

```ts
{
  requestedUrl: string;
  finalUrl: string;
  status: number;
  statusText: string;
  contentType: string | null;
  contentLength: number | null;
  text: string;
  truncated: boolean;
  maxLength: number;
}
```

`requestedUrl` is the normalized input URL. `finalUrl` records the response URL
after redirects. Long text is truncated to `maxLength`, and `truncated` reports
whether truncation happened.

The tool rejects non-HTTP(S) URLs, missing network permission, HTTP 4xx/5xx
responses, timeout/abort failures, and non-text responses. Text responses
include `text/*`, JSON, XML, XHTML, JavaScript, and SVG content types. Binary
responses such as images, archives, audio, and video are rejected before their
bodies are read so binary data is not inserted into agent context.
