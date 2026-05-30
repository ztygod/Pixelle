import {EventBus} from "@pixelle/events";
import type {PixelleEvent} from "@pixelle/events";

export const pixelleEventBus = new EventBus<PixelleEvent>({
  maxHistorySize: 500,
});
