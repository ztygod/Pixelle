import type {CliHandle} from "../events/types.js";

type ScheduledEvent = {
  delayMs: number;
  run: () => void;
};

export function startDemoRuntime(cli: CliHandle): () => void {
  const assistantMessageId = "demo_assistant_login_page";
  const timers: NodeJS.Timeout[] = [];

  const schedule: ScheduledEvent[] = [
    {
      delayMs: 450,
      run: () => {
        cli.pushEvent({
          type: "user_message",
          id: "demo_user_request",
          content: "根据设计稿生成一个登录页",
        });
      },
    },
    {
      delayMs: 900,
      run: () => {
        cli.pushEvent({
          type: "assistant_delta",
          messageId: assistantMessageId,
          delta:
            "我会把它作为 UI 展示任务处理：先确认页面边界，再展示组件片段和模拟改动。这个 demo 不读取文件、不调用模型，也不执行真实工具。\n\n",
        });
      },
    },
    {
      delayMs: 1450,
      run: () => {
        cli.pushEvent({
          type: "tool_start",
          id: "tool_list_files",
          name: "list_files",
          input: {path: "src"},
          description: "Scanning project...",
        });
      },
    },
    {
      delayMs: 2300,
      run: () => {
        cli.pushEvent({
          type: "tool_done",
          id: "tool_list_files",
          name: "list_files",
          output: "src/App.tsx\nsrc/main.tsx\nsrc/components\nsrc/styles.css",
          summary: "4 files",
        });
      },
    },
    {
      delayMs: 2800,
      run: () => {
        cli.pushEvent({
          type: "assistant_delta",
          messageId: assistantMessageId,
          delta:
            "## 项目判断\n\n- React + TypeScript 页面可以作为独立组件落地\n- 登录区域需要明确的表单层级和按钮状态\n- 下一步展示组件草案、样式差异和设计稿路径降级\n\n",
        });
      },
    },
    {
      delayMs: 3650,
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
      delayMs: 4550,
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
      delayMs: 5250,
      run: () => {
        cli.pushEvent({
          type: "tool_start",
          id: "tool_image_preview",
          name: "render_image_preview",
          input: {path: "./assets/login-design.png"},
          description: "Checking terminal image protocol...",
        });
      },
    },
    {
      delayMs: 5900,
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
      delayMs: 6350,
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
      delayMs: 6800,
      run: () => {
        cli.pushEvent({
          type: "error",
          message: "当前终端不支持直接渲染图片，已降级为路径展示。",
        });
      },
    },
    {
      delayMs: 7350,
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
      delayMs: 8100,
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
