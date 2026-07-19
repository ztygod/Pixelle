# Pixelle Agent

[English](./README.md)

Pixelle Agent 是 Pixelle 的独立 Agent Runtime 核心。本仓库现在只关注 runtime package：LLM 抽象、Tool Registry、Tool Runner、Runtime Loop、Event Bus、Config、Workspace 安全路径、Middleware、内置工具，以及 CLI 调试入口。

Pixelle 桌面端产品、Aegis 和官网会在本仓库之外维护。

## 功能

- 用于创建和运行 coding agent 的 Agent Runtime API。
- Provider-neutral 的 LLM 抽象，包含 OpenAI-compatible 和 Anthropic-compatible client。
- 面向内置文件系统、shell、web 工具的 Tool Registry 和 Tool Runner。
- Runtime Event Bus，支持 typed listener、wildcard listener、replay、middleware 和有界历史。
- 从 `pixelle.toml` 加载配置。
- 文件工具使用 Workspace 安全路径处理。
- 基于 Ink 的 CLI 调试入口，对外命令为 `pixelle-agent`。

## 环境要求

- Node.js
- pnpm

## 安装

```sh
pnpm install
```

## 常用命令

```sh
pnpm dev
pnpm dev:cli
pnpm typecheck
pnpm build
```

- `pnpm dev`：watch build Agent package。
- `pnpm dev:cli`：使用源码运行 CLI 调试入口。
- `pnpm typecheck`：检查 Agent package 类型。
- `pnpm build`：编译 TypeScript 到 `dist/`。

构建后，CLI bin 位于 `dist/cli.js`，发布命令名为 `pixelle-agent`。

## API 使用

```ts
import {createAgentRuntimeFromConfig} from "@pixelle/agent";

const agent = await createAgentRuntimeFromConfig();

const result = await agent.run({
  prompt: "Inspect the current workspace and summarize the project.",
});

console.log(result);
```

## 配置

`createAgentRuntimeFromConfig()` 默认从当前工作目录加载 `pixelle.toml`。
TOML 中所有字段都可以省略，省略后会使用下表默认值。

内置 coding-agent 系统提示词带有版本且不可替换。项目级规则通过补充指令追加：

```toml
[runtime]
systemInstructions = [
  "Prefer functional TypeScript.",
  "Do not modify generated files."
]
```

| Section        | 字段                 | 默认值              | 约束                               |
| -------------- | -------------------- | ------------------- | ---------------------------------- |
| `llm`          | `provider`           | `openai-compatible` | `openai-compatible` 或 `anthropic` |
| `llm`          | `model`              | `gpt-4.1`           | 非空字符串                         |
| `llm`          | `temperature`        | `0.2`               | `0` 到 `2` 的数字                  |
| `llm`          | `timeoutMs`          | `120000`            | 正整数                             |
| `llm`          | `maxRetries`         | `2`                 | `0` 到 `10` 的整数                 |
| `llm`          | `apiKey`             | 无                  | 设置时必须是非空字符串             |
| `llm`          | `apiKeyEnv`          | 无                  | 用于读取 `apiKey` 的环境变量名     |
| `llm`          | `baseUrl`            | 无                  | 设置时必须是有效 URL               |
| `runtime`      | `workspaceDir`       | `.`                 | 非空路径，相对 `pixelle.toml` 解析 |
| `runtime`      | `maxIterations`      | `10`                | 正整数                             |
| `runtime`      | `maxRepairAttempts`  | `2`                 | 大于等于 `0` 的整数                |
| `runtime`      | `tokensLimit`        | `32000`             | 正整数                             |
| `runtime`      | `systemInstructions` | `[]`                | 非空补充指令数组                   |
| `runtime`      | `rollbackOnFailure`  | `true`              | Boolean                            |
| `permissions`  | `readFile`           | `true`              | Boolean                            |
| `permissions`  | `writeFile`          | `false`             | Boolean                            |
| `permissions`  | `shell`              | `false`             | Boolean                            |
| `permissions`  | `network`            | `false`             | Boolean                            |
| `verification` | `enabled`            | `true`              | Boolean                            |
| `verification` | `commands`           | `[]`                | 非空字符串数组                     |
| `trace`        | `enabled`            | `true`              | Boolean                            |
| `trace`        | `directory`          | `.pixelle`          | 非空路径，相对 `pixelle.toml` 解析 |

CLI 展示层 API 可从 `./cli` export 获取：

```ts
import {renderCli} from "@pixelle/agent/cli";

const cli = renderCli({title: "Pixelle Agent"});

cli.onUserInput((input) => {
  console.log(input.content);
});
```

## 项目结构

```text
src/agent/       Agent runtime 编排
src/config/      配置加载、schema 和类型
src/events/      Runtime event bus 和事件类型
src/llm/         Provider-neutral LLM client 和请求类型
src/runtime/     Runtime trace、verification、policy 和 workspace scanning
src/tool/        Tool registry、runner 和内置工具
src/workspace/   Workspace 安全路径工具
src/cli/         CLI 展示层 API
src/index.ts     Agent Runtime public API
src/cli.ts       pixelle-agent 可执行入口
```
