# Pixelle

[English](./README.md)

Pixelle 正在演进为面向前端工程的多入口 AI Coding Workspace。当前仓库保留现有 TypeScript + Ink CLI，同时新增了 Web 工作台、Server Runtime 后端和共享 packages 的 monorepo 骨架。

现有 CLI 展示层仍然可以渲染事件流、接收用户输入、展示助手消息、工具状态、错误信息、Markdown、代码块、diff 和图片预览回退。

Pixelle 的 CLI 层本身不调用模型、不执行工具、不扫描或修改文件，也不负责任务编排。外部 runtime 可以通过公开 API 向 CLI 推送事件，并订阅用户输入和 runtime 命令。

## 功能

- 终端 UI 渲染，基于 Ink 和 React。
- 流式助手消息展示。
- 用户消息、工具状态、错误、图片预览和 Markdown 内容展示。
- Slash command 支持：`/help`、`/clear`、`/debug`、`/exit`、`/model`、`/mcp`、`/agent`、`/tool`。
- 独立事件总线，支持 typed listener、wildcard listener、once、replay、middleware 和有界历史。
- Demo runtime，用于截图、视觉检查和本地交互验证。

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
pnpm build
pnpm start
pnpm cli:demo
pnpm dev:web
pnpm dev:server
pnpm build:workspace
pnpm typecheck
```

- `pnpm dev`：使用源码启动独立 Pixelle CLI。
- `pnpm build`：编译 TypeScript 到 `dist/`。
- `pnpm start`：运行编译后的 CLI 入口。
- `pnpm cli:demo`：启动内置 demo runtime，播放模拟事件。
- `pnpm dev:web`：启动 Vite Web 工作台。
- `pnpm dev:server`：启动 Fastify Runtime 后端骨架。
- `pnpm build:workspace`：构建共享 packages、Web 应用和 Server 应用。
- `pnpm typecheck`：检查 workspace packages 和 apps。

## 使用 API

```ts
import {renderCli} from "./apps/cli/src/cli/index.js";

const cli = renderCli({title: "Pixelle"});

cli.onUserInput((input) => {
  console.log(input.content);
});

cli.onRuntimeCommand((command) => {
  console.log(command.raw);
});

cli.pushEvent({
  type: "assistant_delta",
  messageId: "msg_1",
  delta: "Hello from a runtime event.",
});

cli.pushEvent({
  type: "assistant_done",
  messageId: "msg_1",
});
```

## 项目结构

```text
apps/cli/       CLI 可执行入口和终端展示层
apps/web/       React Web 工作台骨架
apps/server/    Fastify Agent Runtime 后端骨架
packages/       共享类型、事件、核心契约、sandbox、prompt、config
demos/          本地 demo runtime
```

更多 CLI 内部说明见 `apps/cli/src/cli/README.md`。
