import type { LlmClient } from "./provider.ts";
import type { ProviderName } from "./config.ts";
import type { FetchFn } from "./http.ts";
import { createAnthropicClient } from "./anthropicClient.ts";
import { createDeepseekClient } from "./deepseekClient.ts";

export function createClient(
  provider: string,
  opts: { apiKey: string; fetchFn?: FetchFn; baseUrl?: string },
): LlmClient {
  switch (provider as ProviderName) {
    case "anthropic":
      return createAnthropicClient(opts);
    case "deepseek":
      return createDeepseekClient(opts);
    default:
      throw new Error(`unknown LLM provider: ${provider}`);
  }
}
