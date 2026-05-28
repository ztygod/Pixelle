import {useConsoleBufferStore} from "@/features/console-stream/model/console-buffer-store";

export function appendRuntimeLog(text: string, level: "info" | "warn" | "error" = "info") {
  useConsoleBufferStore.getState().appendLine({
    level,
    text,
    timestamp: Date.now(),
  });
}
