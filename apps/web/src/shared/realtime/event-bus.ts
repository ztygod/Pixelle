import {EventBus} from "@pixelle/agent";
import type {PixelleEvent} from "@pixelle/agent";

export const pixelleEventBus = new EventBus<PixelleEvent>({
  maxHistorySize: 500,
});
