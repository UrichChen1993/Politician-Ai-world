import type { LlmClient, LlmRequest, LlmResult } from "./provider.ts";
import { safeText, type FetchFn } from "./http.ts";

const DEFAULT_URL = "https://api.deepseek.com/chat/completions";

// DeepSeek exposes an OpenAI-compatible chat-completions API.
export function buildDeepseekBody(req: LlmRequest) {
  return {
    model: req.model,
    max_tokens: req.maxTokens,
    temperature: req.temperature,
    messages: [
      { role: "system", content: req.system },
      { role: "user", content: req.user },
    ],
  };
}

export function parseDeepseekResponse(json: unknown): Omit<LlmResult, "model"> & {
  model: string;
} {
  const j = (json ?? {}) as {
    model?: string;
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  return {
    text: j.choices?.[0]?.message?.content ?? "",
    model: j.model ?? "",
    promptTokens: j.usage?.prompt_tokens ?? 0,
    completionTokens: j.usage?.completion_tokens ?? 0,
  };
}

export function createDeepseekClient(opts: {
  apiKey: string;
  fetchFn?: FetchFn;
  baseUrl?: string;
}): LlmClient {
  const fetchFn = opts.fetchFn ?? fetch;
  const url = opts.baseUrl ?? DEFAULT_URL;
  return async (req: LlmRequest): Promise<LlmResult> => {
    const res = await fetchFn(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${opts.apiKey}`,
      },
      body: JSON.stringify(buildDeepseekBody(req)),
      signal: req.signal,
    });
    if (!res.ok) {
      throw new Error(`deepseek ${res.status}: ${await safeText(res)}`);
    }
    const parsed = parseDeepseekResponse(await res.json());
    return { ...parsed, model: parsed.model || req.model };
  };
}
