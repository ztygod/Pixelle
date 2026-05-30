import type {PixelleEvent} from "@pixelle/events";
import {pixelleEventBus} from "@/shared/realtime/event-bus";
import {useRuntimeLogStore} from "@/features/runtime-status/model/runtime-log-store";
import {useRuntimeStatusStore} from "@/features/runtime-status/model/runtime-status-store";

export function routeRuntimeEvent(event: PixelleEvent) {
  pixelleEventBus.emit(event);

  if (event.type === "runtime.status_changed") {
    useRuntimeStatusStore.getState().setRuntimeStatus(event.status, event.detail);
  }

  if (event.type === "runtime.error") {
    useRuntimeLogStore.getState().appendLine({
      level: "error",
      text: event.message,
      timestamp: event.createdAt ?? Date.now(),
    });
  }
}
