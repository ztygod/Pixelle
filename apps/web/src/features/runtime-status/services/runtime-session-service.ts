export interface RuntimeSession {
  id: string;
  status: "idle" | "booting" | "ready" | "error";
}

export function createPlaceholderRuntimeSession(): RuntimeSession {
  return {
    id: "local-preview",
    status: "idle",
  };
}
