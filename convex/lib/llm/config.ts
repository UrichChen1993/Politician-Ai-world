// Centralized LLM configuration for Phase B (see docs/design/llm-cost-model.md §7).
// Provider-agnostic: the same decision pipeline runs against Anthropic (Haiku) or
// DeepSeek, selected at runtime by the LLM_PROVIDER env var.

export type ProviderName = "anthropic" | "deepseek";

export type ModelRate = {
  inputPerMTok: number; // USD per 1M input (prompt) tokens
  outputPerMTok: number; // USD per 1M output (completion) tokens
};

// Approximate published rates (USD / 1M tokens). DeepSeek pricing fluctuates —
// treat as an estimate; recalibrate against real invoices after the PoC run.
export const MODEL_RATES: Record<string, ModelRate> = {
  "claude-haiku-4-5-20251001": { inputPerMTok: 0.8, outputPerMTok: 4.0 },
  "deepseek-chat": { inputPerMTok: 0.27, outputPerMTok: 1.1 },
};

export const PROVIDER_DEFAULTS: Record<ProviderName, { model: string }> = {
  anthropic: { model: "claude-haiku-4-5-20251001" },
  deepseek: { model: "deepseek-chat" },
};

export const LLM_CONFIG = {
  TIMEOUT_MS: 30_000, // single-call timeout → fallback (poc-plan §5.3)
  MAX_RETRIES: 1, // one retry on schema-validation failure (poc-plan §5.1)
  SHORTCUT_ENABLED: false, // PoC: force LLM on all agents (honest validation)
  SHORTCUT_THRESHOLD: 0.4, // |dot| above this would skip LLM when enabled
  INCLUDE_BAZI: false, // persona depth: stance+disposition only, no 八字
  MAX_OUTPUT_TOKENS: 600,
  TEMPERATURE: 0.3,
  DEFAULT_PROVIDER: "anthropic" as ProviderName,
};
