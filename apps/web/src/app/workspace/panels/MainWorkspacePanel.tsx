import {useState} from "react";
import {AgentTimeline} from "../components/AgentTimeline";
import {PromptComposer} from "../components/PromptComposer";
import {QuickActions} from "../components/QuickActions";
import {cn} from "../../../lib/utils";

type WorkspaceActivityState = "empty" | "active";

export function MainWorkspacePanel() {
  const [workspaceState, setWorkspaceState] =
    useState<WorkspaceActivityState>("empty");
  const [activePrompt, setActivePrompt] = useState<string>("");
  const isActive = workspaceState === "active";

  function startExecution(prompt: string) {
    const nextPrompt = prompt.trim();

    if (!nextPrompt) {
      return;
    }

    setActivePrompt(nextPrompt);
    setWorkspaceState("active");
  }

  return (
    <section className="workspace-panel flex min-h-[560px] min-w-0 flex-col overflow-hidden rounded-lg xl:min-h-0">
      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
        <div
          className={cn(
            "mx-auto flex min-h-full max-w-3xl flex-col py-4 transition-all duration-300 ease-out",
            isActive ? "justify-start" : "justify-center",
          )}
        >
          <div
            className={cn(
              "transition-all duration-300 ease-out",
              isActive ? "mb-5 translate-y-0 opacity-90" : "mb-8 translate-y-0 opacity-100",
            )}
          >
            <p className="mono-label mb-3 text-xs uppercase text-[#8d978a]">
              Agent workspace
            </p>
            <h2
              className={cn(
                "font-semibold tracking-normal text-[#f2f5ed] transition-all duration-300 ease-out",
                isActive ? "text-2xl sm:text-3xl" : "text-3xl sm:text-5xl",
              )}
            >
              你好，我是 Pixelle
            </h2>
            <p
              className={cn(
                "max-w-2xl leading-7 text-[#aeb9a7] transition-all duration-300 ease-out",
                isActive ? "mt-2 text-sm" : "mt-4 text-base",
              )}
            >
              你的 AI 编程助手，帮你构建、调试和交付现代 Web 应用。
            </p>
            {isActive ? (
              <p className="mono-label mt-3 truncate rounded-full border border-[#b7ff55]/16 bg-[#b7ff55]/8 px-3 py-1.5 text-[11px] text-[#caff86]">
                active prompt: {activePrompt}
              </p>
            ) : null}
          </div>

          <QuickActions onSelect={startExecution} />
          <PromptComposer onSubmit={startExecution} />
        </div>
      </div>
      <AgentTimeline visible={isActive} />
    </section>
  );
}
