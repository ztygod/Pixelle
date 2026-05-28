import {ArrowUp, Paperclip, Plus} from "lucide-react";
import {Button} from "@/shared/ui/button";
import {Textarea} from "@/shared/ui/textarea";
import {usePromptDraftStore} from "@/features/prompt-composer/model/prompt-draft-store";
import {createPromptSubmission} from "@/features/prompt-composer/services/prompt-submit-service";

interface PromptComposerProps {
  onSubmit: (prompt: string) => void;
}

export function PromptComposer({onSubmit}: PromptComposerProps) {
  const draft = usePromptDraftStore((state) => state.draft);
  const setDraft = usePromptDraftStore((state) => state.setDraft);
  const clearDraft = usePromptDraftStore((state) => state.clearDraft);

  function submitPrompt() {
    const submission = createPromptSubmission(draft);

    if (!submission) {
      return;
    }

    onSubmit(submission.content);
    clearDraft();
  }

  return (
    <div className="rounded-xl border border-[#b7ff55]/16 bg-[#080b08]/80 p-2 shadow-[0_0_52px_rgba(183,255,85,0.08)]">
      <Textarea
        aria-label="Prompt input"
        onChange={(event) => {
          setDraft(event.target.value);
        }}
        placeholder="描述你想构建、修复或重构的内容..."
        value={draft}
      />
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-2">
        <div className="flex items-center gap-1">
          <Button aria-label="Attach file" size="icon-sm" type="button" variant="ghost">
            <Paperclip size={15} />
          </Button>
          <Button size="sm" type="button" variant="ghost">
            <Plus size={14} />
            Context
          </Button>
        </div>
        <Button onClick={submitPrompt} size="sm" type="button" variant="default">
          Send
          <ArrowUp size={14} />
        </Button>
      </div>
    </div>
  );
}
