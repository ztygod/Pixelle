import type {PixelleEvent} from "@pixelle/events";
import {pixelleEventBus} from "@/shared/realtime/event-bus";
import {useConsoleBufferStore} from "@/features/console-stream/model/console-buffer-store";
import {useRuntimeStore} from "@/features/webcontainer-runtime/model/runtime-store";

export function routeRuntimeEvent(event: PixelleEvent) {
  pixelleEventBus.emit(event);

  if (event.type === "runtime.status_changed") {
    useRuntimeStore.getState().setRuntimeStatus(event.status, event.detail);
  }

  if (event.type === "runtime.error") {
    useConsoleBufferStore.getState().appendLine({
      level: "error",
      text: event.message,
      timestamp: event.createdAt ?? Date.now(),
    });
  }
}
