import type {CliHandle} from "../types/public-api.js";

type ScheduledEvent = {
  delayMs: number;
  run: () => void;
};

export function startDemoRuntime(cli: CliHandle): () => void {
  const assistantMessageId = "demo_assistant_login_page";
  const timers: NodeJS.Timeout[] = [];

  const schedule: ScheduledEvent[] = [
    {
      delayMs: 200,
      run: () => {
        cli.pushEvent({
          type: "user_message",
          id: "demo_user_request",
          content: "根据设计稿生成一个登录页",
        });
      },
    },
    {
      delayMs: 650,
      run: () => {
        cli.pushEvent({
          type: "assistant_delta",
          messageId: assistantMessageId,
          delta: "我会先分析当前项目结构，确认前端技术栈和可落地的组件边界。\n\n",
        });
      },
    },
    {
      delayMs: 1150,
      run: () => {
        cli.pushEvent({
          type: "tool_start",
          id: "tool_list_files",
          name: "list_files",
          input: {path: "src"},
        });
      },
    },
    {
      delayMs: 1900,
      run: () => {
        cli.pushEvent({
          type: "tool_done",
          id: "tool_list_files",
          name: "list_files",
          output: "src/App.tsx\nsrc/main.tsx\nsrc/components\nsrc/styles.css",
        });
      },
    },
    {
      delayMs: 2350,
      run: () => {
        cli.pushEvent({
          type: "assistant_delta",
          messageId: assistantMessageId,
          delta:
            "# 项目判断\n\n- 检测到 React + TypeScript 项目\n- 可以新增一个登录页组件\n- 样式应保持在现有前端边界内\n\n",
        });
      },
    },
    {
      delayMs: 3150,
      run: () => {
        cli.pushEvent({
          type: "assistant_delta",
          messageId: assistantMessageId,
          delta:
            "```tsx\nexport function LoginPage() {\n  return (\n    <main className=\"login-page\">\n      <section className=\"login-panel\">\n        <h1>Welcome back</h1>\n        <button>Sign in</button>\n      </section>\n    </main>\n  );\n}\n```\n\n",
        });
      },
    },
    {
      delayMs: 4100,
      run: () => {
        cli.pushEvent({
          type: "assistant_delta",
          messageId: assistantMessageId,
          delta:
            "```diff\n+ <LoginPage />\n- <Placeholder />\n@@ styles.css @@\n+ .login-page { min-height: 100vh; }\n+ .login-panel { max-width: 420px; }\n```\n\n",
        });
      },
    },
    {
      delayMs: 4800,
      run: () => {
        cli.pushEvent({
          type: "tool_start",
          id: "tool_image_preview",
          name: "render_image_preview",
          input: {path: "./assets/login-design.png"},
        });
      },
    },
    {
      delayMs: 5400,
      run: () => {
        cli.pushEvent({
          type: "tool_error",
          id: "tool_image_preview",
          name: "render_image_preview",
          error: "Current terminal does not expose a supported image protocol.",
        });
      },
    },
    {
      delayMs: 5850,
      run: () => {
        cli.pushEvent({
          type: "image_preview",
          id: "demo_login_design",
          path: "./assets/login-design.png",
          alt: "Login page design reference",
        });
      },
    },
    {
      delayMs: 6300,
      run: () => {
        cli.pushEvent({
          type: "error",
          message: "当前终端不支持直接渲染图片，已降级为路径展示。",
        });
      },
    },
    {
      delayMs: 6900,
      run: () => {
        cli.pushEvent({
          type: "assistant_delta",
          messageId: assistantMessageId,
          delta:
            "> 图片预览已降级，但路径仍保留在上下文中。\n\n我会继续把设计稿作为本地参考路径展示，不执行任何真实文件读取或模型分析。\n",
        });
      },
    },
    {
      delayMs: 7600,
      run: () => {
        cli.pushEvent({
          type: "assistant_done",
          messageId: assistantMessageId,
        });
      },
    },
  ];

  for (const item of schedule) {
    timers.push(setTimeout(item.run, item.delayMs));
  }

  return () => {
    for (const timer of timers) {
      clearTimeout(timer);
    }
  };
}
