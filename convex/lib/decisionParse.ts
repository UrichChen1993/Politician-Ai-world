import type { Vote } from "./decisionLogic.ts";

export type ParsedDecision = {
  vote: Vote;
  reasoning: string;
  citedArticles: number[];
};

// Thrown when the LLM response can't be coerced into a valid decision. The
// orchestrator catches this to drive the retry → fallback chain (poc-plan §5.1).
export class DecisionParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DecisionParseError";
  }
}

const VALID_VOTES = new Set<Vote>(["yes", "no", "abstain"]);

export function parseDecisionResponse(raw: string): ParsedDecision {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch {
    throw new DecisionParseError("response is not valid JSON");
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new DecisionParseError("response is not a JSON object");
  }
  const obj = parsed as Record<string, unknown>;

  if (typeof obj.vote !== "string" || !VALID_VOTES.has(obj.vote as Vote)) {
    throw new DecisionParseError(`invalid vote: ${String(obj.vote)}`);
  }
  if (typeof obj.reasoning !== "string" || obj.reasoning.trim() === "") {
    throw new DecisionParseError("missing or empty reasoning");
  }

  return {
    vote: obj.vote as Vote,
    reasoning: obj.reasoning.trim(),
    citedArticles: normalizeCited(obj.citedArticles),
  };
}

// Pull a JSON object out of a response that may be fenced or wrapped in prose.
function extractJson(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced) return fenced[1].trim();
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first !== -1 && last > first) return trimmed.slice(first, last + 1);
  return trimmed;
}

function normalizeCited(value: unknown): number[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw new DecisionParseError("citedArticles must be an array");
  }
  return value.map((v) => {
    const n =
      typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
    if (!Number.isFinite(n)) {
      throw new DecisionParseError(`citedArticles contains non-number: ${String(v)}`);
    }
    return n;
  });
}
