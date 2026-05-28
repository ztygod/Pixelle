export interface WebContainerSession {
  id: string;
  status: "idle" | "booting" | "ready" | "error";
}

export function createPlaceholderWebContainerSession(): WebContainerSession {
  return {
    id: "local-preview",
    status: "idle",
  };
}
