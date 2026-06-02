import type { LlmClient, LlmRequest, LlmResult } from "./provider.ts";
import { safeText, type FetchFn } from "./http.ts";

// Google's Generative Language API. Unlike Anthropic/DeepSeek the model name goes
// in the URL path (…/models/{model}:generateContent), the system prompt is a
// separate `system_instruction`, and the user turn is a `contents` entry.
const DEFAULT_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export function buildGeminiBody(req: LlmRequest) {
  return {
    system_instruction: { parts: [{ text: req.system }] },
    contents: [{ role: "user", parts: [{ text: req.user }] }],
    generationConfig: {
      maxOutputTokens: req.maxTokens,
      temperature: req.temperature,
      // 2.5-flash "thinks" by default, consuming the output budget — a real run
      // saw 572/600 tokens spent on thoughts and the JSON truncated mid-string
      // (→ schema_validation_failed → fallback). This decision is short and
      // structured; we don't want chain-of-thought eating the answer.
      thinkingConfig: { thinkingBudget: 0 },
    },
  };
}

export function parseGeminiResponse(json: unknown): Omit<LlmResult, "model"> & {
  model: string;
} {
  const j = (json ?? {}) as {
    modelVersion?: string;
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    usageMetadata?: {
      promptTokenCount?: number;
      candidatesTokenCount?: number;
    };
  };
  const parts = j.candidates?.[0]?.content?.parts ?? [];
  const text = parts.map((p) => p.text ?? "").join("");
  return {
    text,
    model: j.modelVersion ?? "",
    promptTokens: j.usageMetadata?.promptTokenCount ?? 0,
    completionTokens: j.usageMetadata?.candidatesTokenCount ?? 0,
  };
}

export function createGeminiClient(opts: {
  apiKey: string;
  fetchFn?: FetchFn;
  baseUrl?: string;
}): LlmClient {
  const fetchFn = opts.fetchFn ?? fetch;
  const base = opts.baseUrl ?? DEFAULT_BASE;
  return async (req: LlmRequest): Promise<LlmResult> => {
    const url = `${base}/${encodeURIComponent(req.model)}:generateContent`;
    const res = await fetchFn(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": opts.apiKey,
      },
      body: JSON.stringify(buildGeminiBody(req)),
      signal: req.signal,
    });
    if (!res.ok) {
      throw new Error(`gemini ${res.status}: ${await safeText(res)}`);
    }
    const parsed = parseGeminiResponse(await res.json());
    return { ...parsed, model: parsed.model || req.model };
  };
}
