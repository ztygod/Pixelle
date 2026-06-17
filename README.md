# Pixelle Agent

[中文](./README.zh-CN.md)

Pixelle Agent is the standalone Agent Runtime core for Pixelle. This repository now focuses on the runtime package only: LLM abstraction, tool registry, tool runner, runtime loop, event bus, config loading, workspace path safety, middleware, built-in tools, and a CLI debug entry.

The Pixelle desktop product, Aegis, and the web site are maintained outside this repository.

## Features

- Agent Runtime API for creating and running coding agents.
- Provider-neutral LLM abstractions with OpenAI-compatible and Anthropic-compatible clients.
- Tool registry and tool runner for built-in filesystem, shell, and web tools.
- Runtime event bus with typed listeners, wildcard listeners, replay, middleware, and bounded history.
- Config loading from `pixelle.toml`.
- Workspace-safe path handling for file tools.
- Ink-based CLI debug entry exposed as `pixelle-agent`.

## Requirements

- Node.js
- pnpm

## Installation

```sh
pnpm install
```

## Commands

```sh
pnpm dev
pnpm dev:cli
pnpm typecheck
pnpm build
```

- `pnpm dev`: watch-build the Agent package.
- `pnpm dev:cli`: run the CLI debug entry from source.
- `pnpm typecheck`: typecheck the Agent package.
- `pnpm build`: compile TypeScript into `dist/`.

After building, the CLI bin is available at `dist/cli.js` and is published as `pixelle-agent`.

## API Usage

```ts
import {createAgentRuntimeFromConfig} from "@pixelle/agent";

const agent = await createAgentRuntimeFromConfig();

const result = await agent.run({
  prompt: "Inspect the current workspace and summarize the project.",
});

console.log(result);
```

## Configuration

`createAgentRuntimeFromConfig()` loads `pixelle.toml` from the current working
directory by default. All fields are optional in the TOML file; omitted values
use the defaults below.

| Section        | Field               | Default                 | Constraints                                         |
| -------------- | ------------------- | ----------------------- | --------------------------------------------------- |
| `llm`          | `provider`          | `openai-compatible`     | `openai-compatible` or `anthropic`                  |
| `llm`          | `model`             | `gpt-4.1`               | Non-empty string                                    |
| `llm`          | `temperature`       | `0.2`                   | Number from `0` to `2`                              |
| `llm`          | `timeoutMs`         | `120000`                | Positive integer                                    |
| `llm`          | `maxRetries`        | `2`                     | Integer from `0` to `10`                            |
| `llm`          | `apiKey`            | None                    | Non-empty string when set                           |
| `llm`          | `apiKeyEnv`         | None                    | Environment variable name used to read `apiKey`     |
| `llm`          | `baseUrl`           | None                    | Valid URL when set                                  |
| `runtime`      | `workspaceDir`      | `.`                     | Non-empty path, resolved relative to `pixelle.toml` |
| `runtime`      | `maxIterations`     | `10`                    | Positive integer                                    |
| `runtime`      | `maxRepairAttempts` | `2`                     | Integer `0` or greater                              |
| `runtime`      | `tokensLimit`       | `32000`                 | Positive integer                                    |
| `runtime`      | `systemPrompt`      | Built-in Pixelle prompt | Non-empty string                                    |
| `runtime`      | `rollbackOnFailure` | `true`                  | Boolean                                             |
| `permissions`  | `readFile`          | `true`                  | Boolean                                             |
| `permissions`  | `writeFile`         | `false`                 | Boolean                                             |
| `permissions`  | `shell`             | `false`                 | Boolean                                             |
| `permissions`  | `network`           | `false`                 | Boolean                                             |
| `verification` | `enabled`           | `true`                  | Boolean                                             |
| `verification` | `commands`          | `[]`                    | Array of non-empty strings                          |
| `trace`        | `enabled`           | `true`                  | Boolean                                             |
| `trace`        | `directory`         | `.pixelle`              | Non-empty path, resolved relative to `pixelle.toml` |

CLI presentation APIs are available from the `./cli` export:

```ts
import {renderCli} from "@pixelle/agent/cli";

const cli = renderCli({title: "Pixelle Agent"});

cli.onUserInput((input) => {
  console.log(input.content);
});
```

## Project Structure

```text
src/agent/       Agent runtime orchestration
src/config/      Config loading, schema, and types
src/events/      Runtime event bus and event types
src/llm/         Provider-neutral LLM clients and request types
src/runtime/     Runtime trace, verification, policy, and workspace scanning
src/tool/        Tool registry, runner, and built-in tools
src/workspace/   Workspace path safety helpers
src/cli/         CLI presentation API
src/index.ts     Agent Runtime public API
src/cli.ts       pixelle-agent executable entry
```
