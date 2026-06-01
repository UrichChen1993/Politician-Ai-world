// The single impure boundary of Phase B: an LlmClient turns a prompt into raw
// text + token usage. decideOnceLLM takes this as an injected dependency, so all
// decision logic is testable with fake clients (canned / malformed responses)
// and never touches a real API in tests.

export type LlmRequest = {
  system: string;
  user: string;
  model: string;
  maxTokens: number;
  temperature: number;
  signal?: AbortSignal;
};

export type LlmResult = {
  text: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
};

export type LlmClient = (req: LlmRequest) => Promise<LlmResult>;
