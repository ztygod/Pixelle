import type {PixelleEvent} from "@pixelle/events";

export type RealtimeMessageHandler = (event: PixelleEvent) => void;

export interface WebSocketClientOptions {
  onEvent: RealtimeMessageHandler;
  onStatusChange?: (status: "connecting" | "connected" | "disconnected" | "error") => void;
}

export class PixelleWebSocketClient {
  private socket?: WebSocket;

  constructor(
    private readonly url: string,
    private readonly options: WebSocketClientOptions,
  ) {}

  connect() {
    this.options.onStatusChange?.("connecting");
    this.socket = new WebSocket(this.url);
    this.socket.addEventListener("open", () => this.options.onStatusChange?.("connected"));
    this.socket.addEventListener("close", () => this.options.onStatusChange?.("disconnected"));
    this.socket.addEventListener("error", () => this.options.onStatusChange?.("error"));
    this.socket.addEventListener("message", (message) => {
      this.options.onEvent(JSON.parse(message.data as string) as PixelleEvent);
    });
  }

  send(command: unknown) {
    this.socket?.send(JSON.stringify(command));
  }

  disconnect() {
    this.socket?.close();
    this.socket = undefined;
  }
}
