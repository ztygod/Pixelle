import type {PixelleEvent} from "@pixelle/events";

export function connectSseStream(
  url: string,
  onEvent: (event: PixelleEvent) => void,
) {
  const source = new EventSource(url);

  source.addEventListener("message", (message) => {
    onEvent(JSON.parse(message.data) as PixelleEvent);
  });

  return () => {
    source.close();
  };
}
