import type {CliHandle} from "../../apps/cli/src/cli/index.js";

type ScheduledEvent = {
  delayMs: number;
  run: () => void;
};

export function startDemoRuntime(cli: CliHandle): () => void {
  const planningMessageId = "demo_assistant_planning";
  const executionMessageId = "demo_assistant_execution";
  const fallbackMessageId = "demo_assistant_fallback";
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
          type: "assistant_stage",
          messageId: planningMessageId,
          stage: "thinking",
        });
        cli.pushEvent({
          type: "assistant_delta",
          messageId: planningMessageId,
          stage: "thinking",
          delta:
            "我会把它作为 UI 展示任务处理。这个 demo 只播放模拟 runtime 事件：不读取文件、不调用模型，也不执行真实工具。\n\n",
        });
      },
    },
    {
      delayMs: 1350,
      run: () => {
        cli.pushEvent({
          type: "assistant_stage",
          messageId: planningMessageId,
          stage: "planning",
        });
        cli.pushEvent({
          type: "assistant_delta",
          messageId: planningMessageId,
          stage: "planning",
          delta:
            "## Plan\n\n- Identify the page shell and input states\n- Generate a compact React component\n- Summarize the visual diff and image fallback path\n\n",
        });
        cli.pushEvent({
          type: "assistant_done",
          messageId: planningMessageId,
        });
      },
    },
    {
      delayMs: 1900,
      run: () => {
        cli.pushEvent({
          type: "tool_start",
          id: "tool_list_files",
          name: "list_files",
          status: "pending",
          input: {path: "src"},
          description: "Queued project scan",
        });
      },
    },
    {
      delayMs: 2350,
      run: () => {
        cli.pushEvent({
          type: "tool_start",
          id: "tool_list_files",
          name: "list_files",
          input: {path: "src"},
          description: "Scanning project shape",
        });
      },
    },
    {
      delayMs: 3050,
      run: () => {
        cli.pushEvent({
          type: "tool_done",
          id: "tool_list_files",
          name: "list_files",
          output: "src/App.tsx\nsrc/main.tsx\nsrc/components\nsrc/styles.css",
          summary: "4 files discovered",
        });
      },
    },
    {
      delayMs: 3500,
      run: () => {
        cli.pushEvent({
          type: "assistant_stage",
          messageId: executionMessageId,
          stage: "executing",
        });
        cli.pushEvent({
          type: "assistant_delta",
          messageId: executionMessageId,
          stage: "executing",
          delta:
            "## Runtime notes\n\n- React + TypeScript 页面可以作为独立组件落地\n- 登录区域需要明确表单层级、按钮状态和辅助链接\n- 接下来展示组件草案和模拟 diff\n\n",
        });
      },
    },
    {
      delayMs: 4300,
      run: () => {
        cli.pushEvent({
          type: "assistant_delta",
          messageId: executionMessageId,
          stage: "executing",
          delta:
            "```tsx\nexport function LoginPage() {\n  return (\n    <main className=\"login-page\">\n      <section className=\"login-panel\">\n        <h1>Welcome back</h1>\n        <button>Sign in</button>\n      </section>\n    </main>\n  );\n}\n```\n\n",
        });
      },
    },
    {
      delayMs: 5400,
      run: () => {
        cli.pushEvent({
          type: "assistant_delta",
          messageId: executionMessageId,
          stage: "executing",
          delta:
            "```diff\n+ <LoginPage />\n- <Placeholder />\n@@ styles.css @@\n+ .login-page { min-height: 100vh; }\n+ .login-panel { max-width: 420px; }\n```\n\n",
        });
        cli.pushEvent({
          type: "assistant_done",
          messageId: executionMessageId,
        });
      },
    },
    {
      delayMs: 6200,
      run: () => {
        cli.pushEvent({
          type: "tool_start",
          id: "tool_image_preview",
          name: "render_image_preview",
          status: "pending",
          input: {path: "./assets/login-design.png"},
          description: "Queued image preview",
        });
      },
    },
    {
      delayMs: 6500,
      run: () => {
        cli.pushEvent({
          type: "tool_start",
          id: "tool_image_preview",
          name: "render_image_preview",
          input: {path: "./assets/login-design.png"},
          description: "Checking terminal image protocol",
        });
      },
    },
    {
      delayMs: 7100,
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
      delayMs: 7550,
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
      delayMs: 7900,
      run: () => {
        cli.pushEvent({
          type: "error",
          message: "当前终端不支持直接渲染图片，已降级为路径展示。",
        });
      },
    },
    {
      delayMs: 8450,
      run: () => {
        cli.pushEvent({
          type: "assistant_stage",
          messageId: fallbackMessageId,
          stage: "executing",
        });
        cli.pushEvent({
          type: "assistant_delta",
          messageId: fallbackMessageId,
          stage: "executing",
          delta:
            "> 图片预览已降级，但路径仍保留在上下文中。\n\n我会继续把设计稿作为本地参考路径展示，不执行任何真实文件读取或模型分析。\n",
        });
      },
    },
    {
      delayMs: 9050,
      run: () => {
        cli.pushEvent({
          type: "cli_help_toggle",
        });
      },
    },
    {
      delayMs: 9650,
      run: () => {
        cli.pushEvent({
          type: "assistant_done",
          messageId: fallbackMessageId,
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
