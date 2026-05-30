import {useRuntimeLogStore} from "@/features/runtime-status/model/runtime-log-store";

export function appendRuntimeLog(
  text: string,
  level: "info" | "warn" | "error" = "info",
) {
  useRuntimeLogStore.getState().appendLine({
    level,
    text,
    timestamp: Date.now(),
  });
}
