import type { LlmClient, LlmRequest, LlmResult } from "./provider.ts";
import { safeText, type FetchFn } from "./http.ts";

const DEFAULT_URL = "https://api.anthropic.com/v1/messages";

// System prompt is sent as a cacheable text block (llm-cost-model.md §4): the
// fixed header repeats across all agents, so ephemeral caching cuts input cost.
export function buildAnthropicBody(req: LlmRequest) {
  return {
    model: req.model,
    max_tokens: req.maxTokens,
    temperature: req.temperature,
    system: [
      { type: "text", text: req.system, cache_control: { type: "ephemeral" } },
    ],
    messages: [{ role: "user", content: req.user }],
  };
}

export function parseAnthropicResponse(json: unknown): Omit<LlmResult, "model"> & {
  model: string;
} {
  const j = (json ?? {}) as {
    model?: string;
    content?: { type?: string; text?: string }[];
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  const text = Array.isArray(j.content)
    ? j.content
        .filter((b) => b.type === "text")
        .map((b) => b.text ?? "")
        .join("")
    : "";
  return {
    text,
    model: j.model ?? "",
    promptTokens: j.usage?.input_tokens ?? 0,
    completionTokens: j.usage?.output_tokens ?? 0,
  };
}

export function createAnthropicClient(opts: {
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
        "x-api-key": opts.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(buildAnthropicBody(req)),
      signal: req.signal,
    });
    if (!res.ok) {
      throw new Error(`anthropic ${res.status}: ${await safeText(res)}`);
    }
    const parsed = parseAnthropicResponse(await res.json());
    return { ...parsed, model: parsed.model || req.model };
  };
}
