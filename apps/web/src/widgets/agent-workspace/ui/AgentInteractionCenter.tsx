import {useAgentExecutionStore} from "@/features/agent-execution";
import {TaskTimeline} from "@/features/task-timeline";
import {PromptComposer, QuickActions} from "@/features/prompt-composer";
import {Button} from "@/shared/ui/button";
import {cn} from "@/shared/lib/cn";
import {useAgentInteractionViewStore} from "@/widgets/agent-workspace/model/agent-interaction-view-store";
import {CodeView} from "@/widgets/agent-workspace/ui/CodeView";

export function AgentInteractionCenter() {
  const activePrompt = useAgentExecutionStore((state) => state.activePrompt);
  const startExecution = useAgentExecutionStore((state) => state.startExecution);
  const isActive = useAgentExecutionStore(
    (state) => state.workspaceState === "active",
  );
  const activeView = useAgentInteractionViewStore((state) => state.activeView);
  const setActiveView = useAgentInteractionViewStore(
    (state) => state.setActiveView,
  );

  return (
    <section className="workspace-panel flex min-h-[560px] min-w-0 flex-col overflow-hidden rounded-lg xl:h-full xl:min-h-0">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--color-border-subtle)] px-3 py-2">
        <div className="min-w-0">
          <p className="mono-label text-[10px] uppercase text-[var(--color-text-tertiary)]">
            Agent workspace
          </p>
          <h2 className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
            {activeView === "code" ? "Code View" : "AI Chat"}
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-1 rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-1">
          <Button
            onClick={() => setActiveView("chat")}
            size="sm"
            type="button"
            variant={activeView === "chat" ? "default" : "ghost"}
          >
            AI Chat
          </Button>
          <Button
            onClick={() => setActiveView("code")}
            size="sm"
            type="button"
            variant={activeView === "code" ? "default" : "ghost"}
          >
            Code
          </Button>
        </div>
      </div>

      {activeView === "chat" ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-5 sm:py-6">
          <div
            className={cn(
              "mx-auto flex min-h-full max-w-3xl flex-col transition-all duration-300 ease-out",
              isActive
                ? "pt-2 sm:pt-4"
                : "justify-start pt-[14vh] sm:pt-[16vh] xl:pt-[12vh]",
            )}
          >
            <div
              className={cn(
                "transition-all duration-300 ease-out",
                isActive
                  ? "mb-5 translate-y-0 opacity-90"
                  : "mb-8 translate-y-0 opacity-100",
              )}
            >
              <p className="mono-label mb-3 text-xs uppercase text-[var(--color-text-tertiary)]">
                Agent workspace
              </p>
              <h2
                className={cn(
                  "font-semibold tracking-normal text-[var(--color-text-primary)] transition-all duration-300 ease-out",
                  isActive ? "text-2xl sm:text-3xl" : "text-3xl sm:text-5xl",
                )}
              >
                你好，我是 Pixelle
              </h2>
              <p
                className={cn(
                  "max-w-2xl leading-7 text-[var(--color-text-secondary)] transition-all duration-300 ease-out",
                  isActive ? "mt-2 text-sm" : "mt-4 text-base",
                )}
              >
                你的 AI 编程助手，帮你构建、调试和交付现代 Web 应用。
              </p>
              {isActive ? (
                <p className="mono-label mt-3 truncate rounded-full border border-[var(--color-accent-border)] bg-[var(--color-accent-subtle)] px-3 py-1.5 text-[11px] text-[var(--color-accent)]">
                  active prompt: {activePrompt}
                </p>
              ) : null}
            </div>

            <QuickActions onSelect={startExecution} />
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-hidden p-3">
          <div className="min-h-full overflow-hidden rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-inset)]">
            <CodeView />
          </div>
        </div>
      )}

      {activeView === "chat" ? <TaskTimeline visible={isActive} /> : null}
      {activeView === "chat" ? (
        <div className="shrink-0 border-t border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] px-4 py-3 sm:px-5">
          <div className="mx-auto max-w-3xl">
            <PromptComposer onSubmit={startExecution} />
          </div>
        </div>
      ) : null}
    </section>
  );
}
