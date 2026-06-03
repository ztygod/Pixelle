export type ModelProviderConfig = {
  provider: "openai" | "mock";
  model: string;
  apiKeyEnv?: string;
};

export type PixelleAgentConfig = {
  serverPort: number;
  webOrigin: string;
  model: ModelProviderConfig;
};

export const defaultPixelleConfig: PixelleAgentConfig = {
  serverPort: 4317,
  webOrigin: "http://localhost:5173",
  model: {
    provider: "mock",
    model: "mock-coding-agent",
  },
};
