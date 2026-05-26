import {
  Activity,
  Bot,
  Braces,
  FileCode2,
  GitBranch,
  PanelRight,
  Play,
  TerminalSquare,
} from "lucide-react";
import type {AgentEvent} from "@pixelle/events";
import {useMemo} from "react";

const demoEvents: AgentEvent[] = [
  {
    type: "conversation.user_message",
    content: "Create a responsive pricing section from this screenshot.",
    createdAt: Date.now() - 4800,
  },
  {
    type: "tool.call_started",
    id: "tool_scan",
    name: "context_builder",
    description: "Reading selected project files",
    status: "running",
    createdAt: Date.now() - 3200,
  },
  {
    type: "conversation.assistant_delta",
    messageId: "msg_plan",
    delta: "I will map the screenshot into components, extract reusable tokens, then generate a patch for the workspace.",
    stage: "planning",
    createdAt: Date.now() - 1700,
  },
  {
    type: "artifact.diff_created",
    id: "diff_1",
    title: "PricingPanel.tsx + pricing.css",
    diff: "+84 -12",
    createdAt: Date.now() - 500,
  },
];

const files = [
  "src/app/App.tsx",
  "src/components/pricing/PricingPanel.tsx",
  "src/components/runtime/EventPanel.tsx",
  "src/styles/tokens.css",
];

export function App() {
  const latestEvent = useMemo(() => demoEvents.at(-1), []);

  return (
    <main className="workspace-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Pixelle</p>
          <h1>AI Coding Workspace</h1>
        </div>
        <div className="topbar-actions">
          <span className="status-pill">
            <Activity size={14} />
            Runtime idle
          </span>
          <button className="icon-button" aria-label="Run preview">
            <Play size={16} />
          </button>
          <button className="icon-button" aria-label="Open terminal">
            <TerminalSquare size={16} />
          </button>
        </div>
      </header>

      <section className="workspace-grid">
        <aside className="rail left-rail">
          <div className="panel-title">
            <FileCode2 size={16} />
            Project
          </div>
          <div className="branch-row">
            <GitBranch size={14} />
            feat/workspace-shell
          </div>
          <nav className="file-list" aria-label="Project files">
            {files.map((file) => (
              <button key={file}>{file}</button>
            ))}
          </nav>
        </aside>

        <section className="main-stage">
          <div className="chat-strip">
            <div className="speaker">
              <Bot size={18} />
            </div>
            <div>
              <p className="message-label">Planning</p>
              <p>
                I will keep CLI and Web on the same AgentEvent stream, then
                apply changes through a local runtime when connected.
              </p>
            </div>
          </div>

          <div className="editor-frame">
            <div className="editor-tabs">
              <button className="active">PricingPanel.tsx</button>
              <button>tokens.css</button>
              <button>diff</button>
            </div>
            <pre aria-label="Editor preview">{`export function PricingPanel() {
  return (
    <section className="pricing-grid">
      <PlanCard tone="signal" />
      <PlanCard tone="studio" />
      <PlanCard tone="ship" />
    </section>
  );
}`}</pre>
          </div>
        </section>

        <aside className="rail right-rail">
          <div className="panel-title">
            <PanelRight size={16} />
            Runtime
          </div>
          <div className="event-stack">
            {demoEvents.map((event) => (
              <article key={`${event.type}-${event.createdAt}`} className="event-card">
                <span>{event.type}</span>
                <strong>{formatEvent(event)}</strong>
              </article>
            ))}
          </div>
          <div className="protocol-card">
            <Braces size={16} />
            <div>
              <span>Shared protocol</span>
              <strong>{latestEvent?.type ?? "none"}</strong>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}

function formatEvent(event: AgentEvent): string {
  switch (event.type) {
    case "conversation.user_message":
      return event.content;
    case "tool.call_started":
      return event.description ?? event.name;
    case "conversation.assistant_delta":
      return event.delta;
    case "artifact.diff_created":
      return event.title;
    default:
      return event.type;
  }
}
