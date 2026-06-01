import type { LlmClient, LlmResult } from "./llm/provider.ts";
import {
  decideVote,
  dotProduct,
  reasoningForScore,
  type StanceVector,
  type Vote,
} from "./decisionLogic.ts";
import {
  buildDecisionPrompt,
  type PromptAgent,
  type PromptBill,
} from "./decisionPrompt.ts";
import { parseDecisionResponse, DecisionParseError } from "./decisionParse.ts";
import { checkReferences } from "./referenceCheck.ts";
import { estimateCostUsd } from "./llm/cost.ts";
import { LLM_CONFIG } from "./llm/config.ts";

export type DecisionSource = "llm" | "fallback";

export type LlmCallLogEntry = {
  action: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  latencyMs: number;
  ok: boolean;
  errorKind?: string;
};

export type DecideOnceResult = {
  vote: Vote;
  reasoning: string;
  source: DecisionSource;
  llmCall: LlmCallLogEntry;
};

export type DecideOnceOptions = {
  agent: PromptAgent & { stanceVector: StanceVector };
  bill: PromptBill & { stanceVector: StanceVector };
  client: LlmClient;
  model: string;
  timeoutMs?: number;
  maxRetries?: number;
  now?: () => number; // injectable clock (default Date.now)
};

class TimeoutError extends Error {
  constructor() {
    super("llm call timed out");
    this.name = "TimeoutError";
  }
}

// Phase B decision for one agent. Wraps the injected LLM client in the four
// fault-tolerance layers (poc-plan §5): timeout, schema validation + 1 retry,
// reference check (non-fatal), and a Phase A dot-product fallback. Always
// returns a vote and a fully-populated llmCall log entry — it never throws.
export async function decideOnceLLM(
  opts: DecideOnceOptions,
): Promise<DecideOnceResult> {
  const { agent, bill, client, model } = opts;
  const now = opts.now ?? (() => Date.now());
  const timeoutMs = opts.timeoutMs ?? LLM_CONFIG.TIMEOUT_MS;
  const maxRetries = opts.maxRetries ?? LLM_CONFIG.MAX_RETRIES;

  const prompt = buildDecisionPrompt(agent, bill);
  const validArticleNos = bill.articles.map((a) => a.articleNo);

  const start = now();
  let promptTokens = 0;
  let completionTokens = 0;
  let resolvedModel = model;
  let lastErrorKind = "unknown_error";

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await callWithTimeout(
        client,
        {
          system: prompt.system,
          user: prompt.user,
          model,
          maxTokens: LLM_CONFIG.MAX_OUTPUT_TOKENS,
          temperature: LLM_CONFIG.TEMPERATURE,
        },
        timeoutMs,
      );
      // We paid for these tokens whether or not parsing succeeds.
      promptTokens += result.promptTokens;
      completionTokens += result.completionTokens;
      resolvedModel = result.model || model;

      const parsed = parseDecisionResponse(result.text);
      const { hallucinated } = checkReferences(
        parsed.citedArticles,
        validArticleNos,
      );

      return {
        vote: parsed.vote,
        reasoning: parsed.reasoning,
        source: "llm",
        llmCall: {
          action: "decideVote",
          model: resolvedModel,
          promptTokens,
          completionTokens,
          costUsd: estimateCostUsd(resolvedModel, promptTokens, completionTokens),
          latencyMs: now() - start,
          ok: true, // a vote was produced; hallucination is non-fatal
          errorKind:
            hallucinated.length > 0 ? "hallucinated_reference" : undefined,
        },
      };
    } catch (err) {
      lastErrorKind = classifyError(err);
      // fall through to retry, or to fallback after the last attempt
    }
  }

  // All attempts exhausted → Phase A dot-product fallback.
  const score = dotProduct(agent.stanceVector, bill.stanceVector);
  return {
    vote: decideVote(agent.stanceVector, bill.stanceVector),
    reasoning: `[fallback] ${reasoningForScore(score)}`,
    source: "fallback",
    llmCall: {
      action: "decideVote",
      model: resolvedModel,
      promptTokens,
      completionTokens,
      costUsd: estimateCostUsd(resolvedModel, promptTokens, completionTokens),
      latencyMs: now() - start,
      ok: false,
      errorKind: lastErrorKind,
    },
  };
}

async function callWithTimeout(
  client: LlmClient,
  req: Omit<Parameters<LlmClient>[0], "signal">,
  timeoutMs: number,
): Promise<LlmResult> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new TimeoutError());
    }, timeoutMs);
  });
  try {
    return await Promise.race([
      client({ ...req, signal: controller.signal }),
      timeout,
    ]);
  } finally {
    clearTimeout(timer!);
  }
}

function classifyError(err: unknown): string {
  if (err instanceof TimeoutError) return "timeout";
  if (err instanceof DecisionParseError) return "schema_validation_failed";
  if (
    err !== null &&
    typeof err === "object" &&
    "name" in err &&
    (err as { name?: unknown }).name === "AbortError"
  ) {
    return "timeout";
  }
  return "llm_request_failed";
}
