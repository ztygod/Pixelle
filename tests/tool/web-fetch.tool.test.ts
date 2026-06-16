import {afterEach, describe, expect, it, vi} from "vitest";

import {
  DEFAULT_WEB_FETCH_MAX_LENGTH,
  DEFAULT_WEB_FETCH_TIMEOUT_MS,
  ToolRegistry,
  ToolRunner,
  webFetchTool,
} from "../../src/tool/index.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();

  if (originalFetch) {
    vi.stubGlobal("fetch", originalFetch);
  }
});

describe("webFetchTool", () => {
  it("returns text and HTTP metadata for a 2xx text response", async () => {
    const fetchMock = stubFetch(
      new Response("hello", {
        status: 200,
        statusText: "OK",
        headers: {
          "content-length": "5",
          "content-type": "text/plain; charset=utf-8",
        },
      }),
    );

    const result = await runWebFetch({
      reason: "read known page",
      url: "https://example.com/path",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      ok: true,
      data: {
        requestedUrl: "https://example.com/path",
        finalUrl: "https://example.com/path",
        status: 200,
        statusText: "OK",
        contentType: "text/plain; charset=utf-8",
        contentLength: 5,
        text: "hello",
        truncated: false,
        maxLength: DEFAULT_WEB_FETCH_MAX_LENGTH,
      },
    });
  });

  it("records the final URL after redirects", async () => {
    const response = new Response("redirected", {
      status: 200,
      headers: {"content-type": "text/plain"},
    });
    Object.defineProperty(response, "url", {
      value: "https://example.com/final",
    });
    stubFetch(response);

    const result = await runWebFetch({
      reason: "read redirected page",
      url: "https://example.com/start",
    });

    expect(result).toMatchObject({
      ok: true,
      data: {
        requestedUrl: "https://example.com/start",
        finalUrl: "https://example.com/final",
      },
    });
  });

  it("truncates oversized text at maxLength", async () => {
    stubFetch(
      new Response("abcdef", {
        status: 200,
        headers: {"content-type": "application/json"},
      }),
    );

    const result = await runWebFetch({
      reason: "read json",
      url: "https://example.com/data.json",
      maxLength: 3,
    });

    expect(result).toMatchObject({
      ok: true,
      data: {
        text: "abc",
        truncated: true,
        maxLength: 3,
      },
    });
  });

  it("does not mark short text as truncated", async () => {
    stubFetch(
      new Response("abc", {
        status: 200,
        headers: {"content-type": "application/xml"},
      }),
    );

    const result = await runWebFetch({
      reason: "read xml",
      url: "https://example.com/data.xml",
      maxLength: 10,
    });

    expect(result).toMatchObject({
      ok: true,
      data: {
        text: "abc",
        truncated: false,
      },
    });
  });

  it("returns structured failures for 4xx and 5xx responses", async () => {
    const response = new Response("not found", {
      status: 404,
      statusText: "Not Found",
      headers: {
        "content-length": "9",
        "content-type": "text/plain",
      },
    });
    Object.defineProperty(response, "url", {
      value: "https://example.com/missing",
    });
    stubFetch(response);

    const result = await runWebFetch({
      reason: "read missing page",
      url: "https://example.com/missing",
    });

    expect(result).toMatchObject({
      ok: false,
      code: "TOOL_EXECUTION_FAILED",
      message: "web_fetch failed with HTTP 404.",
      data: {
        status: 404,
        statusText: "Not Found",
        requestedUrl: "https://example.com/missing",
        finalUrl: "https://example.com/missing",
        contentType: "text/plain",
        contentLength: 9,
      },
    });
  });

  it("rejects non-HTTP URLs before calling fetch", async () => {
    const fetchMock = stubFetch(
      new Response("never", {
        status: 200,
        headers: {"content-type": "text/plain"},
      }),
    );

    const result = await runWebFetch({
      reason: "read local file",
      url: "file:///tmp/example.txt",
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      ok: false,
      code: "TOOL_INVALID_INPUT",
    });
  });

  it("rejects when network permission is disabled", async () => {
    const fetchMock = stubFetch(
      new Response("never", {
        status: 200,
        headers: {"content-type": "text/plain"},
      }),
    );

    const result = await runWebFetch(
      {
        reason: "read page",
        url: "https://example.com",
      },
      {network: false},
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      ok: false,
      code: "TOOL_PERMISSION_DENIED",
    });
  });

  it("rejects non-text content types before reading the body", async () => {
    stubFetch(
      new Response("binary bytes", {
        status: 200,
        statusText: "OK",
        headers: {
          "content-length": "12",
          "content-type": "image/png",
        },
      }),
    );

    const result = await runWebFetch({
      reason: "read image",
      url: "https://example.com/image.png",
    });

    expect(result).toMatchObject({
      ok: false,
      code: "TOOL_EXECUTION_FAILED",
      data: {
        status: 200,
        statusText: "OK",
        requestedUrl: "https://example.com/image.png",
        finalUrl: "https://example.com/image.png",
        contentType: "image/png",
        contentLength: 12,
      },
    });
  });

  it("normalizes fetch timeout failures", async () => {
    vi.useFakeTimers();
    stubFetchWithAbort();

    const resultPromise = runWebFetch({
      reason: "read slow page",
      url: "https://example.com/slow",
      timeoutMs: 10,
    });

    await vi.advanceTimersByTimeAsync(10);

    await expect(resultPromise).resolves.toMatchObject({
      ok: false,
      code: "TOOL_TIMEOUT",
      data: {
        requestedUrl: "https://example.com/slow",
        timeoutMs: 10,
      },
    });
  });

  it("normalizes external abort failures", async () => {
    const controller = new AbortController();
    stubFetchWithAbort();

    const resultPromise = runWebFetch(
      {
        reason: "read aborting page",
        url: "https://example.com/abort",
      },
      {network: true},
      controller.signal,
    );

    controller.abort();

    await expect(resultPromise).resolves.toMatchObject({
      ok: false,
      code: "TOOL_ABORTED",
    });
  });

  it("uses default maxLength and timeoutMs when omitted", async () => {
    const fetchMock = vi.fn(async (_url: URL | RequestInfo, init?: RequestInit) => {
      expect(init?.signal).toBeInstanceOf(AbortSignal);

      return new Response("default", {
        status: 200,
        headers: {"content-type": "text/plain"},
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await runWebFetch({
      reason: "read defaults",
      url: "https://example.com/default",
    });

    expect(result).toMatchObject({
      ok: true,
      data: {
        text: "default",
        maxLength: DEFAULT_WEB_FETCH_MAX_LENGTH,
        truncated: false,
      },
    });
    expect(DEFAULT_WEB_FETCH_TIMEOUT_MS).toBe(15_000);
  });
});

function stubFetch(response: Response) {
  const fetchMock = vi.fn(async () => response);
  vi.stubGlobal("fetch", fetchMock);

  return fetchMock;
}

function stubFetchWithAbort() {
  const fetchMock = vi.fn((_url: URL | RequestInfo, init?: RequestInit) => {
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener(
        "abort",
        () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        },
        {once: true},
      );
    });
  });
  vi.stubGlobal("fetch", fetchMock);

  return fetchMock;
}

async function runWebFetch(
  input: {
    reason: string;
    url: string;
    maxLength?: number;
    timeoutMs?: number;
  },
  permissions: {network?: boolean} = {network: true},
  signal?: AbortSignal,
) {
  const registry = new ToolRegistry();
  registry.register(webFetchTool);

  return await new ToolRunner(registry).run(
    "web_fetch",
    input,
    {
      workspaceRoot: process.cwd(),
      permissions,
    },
    {signal, timeoutMs: false},
  );
}
