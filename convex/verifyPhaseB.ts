import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

// Phase B verification harness (poc-plan tasks 7, 8). Drives the full loop
// `startSession → runTickLLM → endSession → sessionStats` N times and rolls the
// results up into one summary, so checking a sample is a single `convex run`
// instead of eyeballing tables by hand.
//
//   npx convex run verifyPhaseB:verifyPhaseB                      # 10 runs, seed 748
//   npx convex run verifyPhaseB:verifyPhaseB '{"runs":5}'         # bash/zsh
//   npx convex run verifyPhaseB:verifyPhaseB '{\"runs\":5}'       # PowerShell
//
// Read the summary top-down:
//   1. totalFallbacks / totalLlmCalls — if fallbacks dominate, the matchRate is
//      really Phase A's score, not the LLM's. Check errorKinds to see why.
//   2. avgMatchRate / matchRates — accuracy vs ground truth (target >= 0.8).
//   3. matchRates spread — seed stability (same seed should stay tight).
//   4. totalCostUsd / avgLatencyMs —量綱 sanity.

type RunRow = {
  run: number;
  sessionId: string;
  matchCount: number;
  total: number;
  matchRate: number;
  fallbacks: number;
  llmCount: number;
  errorKinds: Record<string, number>;
  costUsd: number;
};

type VerifySummary = {
  runs: number;
  seed: number;
  avgMatchRate: number;
  matchRates: number[];
  totalLlmCalls: number;
  totalFallbacks: number;
  errorKinds: Record<string, number>;
  totalCostUsd: number;
  avgLatencyMs: number;
  perRun: RunRow[];
};

export const verifyPhaseB = action({
  // seed omitted → reuse 748 every run (stability check). Pass seed:null behaviour
  // is not exposed; vary manually by calling with different seeds if needed.
  args: { runs: v.optional(v.number()), seed: v.optional(v.number()) },
  handler: async (ctx, args): Promise<VerifySummary> => {
    const runs = args.runs ?? 10;
    const seed = args.seed ?? 748;

    const perRun: RunRow[] = [];
    const errorKinds: Record<string, number> = {};
    let totalLlmCalls = 0;
    let totalFallbacks = 0;
    let totalCostUsd = 0;
    let latencySum = 0;

    for (let i = 0; i < runs; i++) {
      const { sessionId }: { sessionId: Id<"sessions">; billsInScope: number } =
        await ctx.runMutation(api.startSession.startSession, { seed });

      const tick: { decisions: number; billId: unknown; fallbacks: number } =
        await ctx.runAction(api.runTickLLM.runTickLLM, { sessionId });

      const result: { matchCount: number; total: number; matchRate: number } =
        await ctx.runMutation(api.endSession.endSession, { sessionId });

      const stats: {
        llmCount: number;
        errorKinds: Record<string, number>;
        totalCostUsd: number;
        avgLatencyMs: number;
      } = await ctx.runQuery(api.queries.sessionStats, { sessionId });

      for (const [kind, n] of Object.entries(stats.errorKinds)) {
        errorKinds[kind] = (errorKinds[kind] ?? 0) + n;
      }
      totalLlmCalls += stats.llmCount;
      totalFallbacks += tick.fallbacks;
      totalCostUsd += stats.totalCostUsd;
      latencySum += stats.avgLatencyMs;

      perRun.push({
        run: i + 1,
        sessionId: String(sessionId),
        matchCount: result.matchCount,
        total: result.total,
        matchRate: result.matchRate,
        fallbacks: tick.fallbacks,
        llmCount: stats.llmCount,
        errorKinds: stats.errorKinds,
        costUsd: stats.totalCostUsd,
      });
    }

    const matchRates = perRun.map((r) => r.matchRate);
    const avgMatchRate =
      matchRates.length === 0
        ? 0
        : matchRates.reduce((a, b) => a + b, 0) / matchRates.length;

    return {
      runs,
      seed,
      avgMatchRate,
      matchRates,
      totalLlmCalls,
      totalFallbacks,
      errorKinds,
      totalCostUsd,
      avgLatencyMs: runs === 0 ? 0 : Math.round(latencySum / runs),
      perRun,
    };
  },
});
