import { MODEL_RATES } from "./config.ts";

// Estimate the USD cost of one LLM call. Unknown models return 0 rather than
// throwing — cost logging must never break the simulation loop.
export function estimateCostUsd(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const rate = MODEL_RATES[model];
  if (!rate) return 0;
  const usd =
    (promptTokens / 1_000_000) * rate.inputPerMTok +
    (completionTokens / 1_000_000) * rate.outputPerMTok;
  // Round to the microdollar to avoid float noise in stored/displayed costs.
  return Math.round(usd * 1_000_000) / 1_000_000;
}
