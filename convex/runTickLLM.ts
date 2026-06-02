import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { runTickLLMHandler } from "./lib/runTickLLMHandler.ts";
import { createClient } from "./lib/llm/createClient.ts";
import { LLM_CONFIG, PROVIDER_DEFAULTS, type ProviderName } from "./lib/llm/config.ts";

export { runTickLLMHandler } from "./lib/runTickLLMHandler.ts";

// Explicit so tsc doesn't try to infer the handler's return type through the
// generated `api` (which references this very action → circular → implicit any).
type TickResult = { decisions: number; billId: unknown; fallbacks: number };

// Phase B tick: an action (LLM calls need network, which queries/mutations can't
// do). Provider + key + model come from Convex env vars:
//   LLM_PROVIDER = anthropic | deepseek | gemini   (default anthropic)
//   ANTHROPIC_API_KEY / DEEPSEEK_API_KEY / GEMINI_API_KEY  (set via `npx convex env set`)
//   LLM_MODEL    = optional override
export const runTickLLM = action({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args): Promise<TickResult> => {
    const provider = (process.env.LLM_PROVIDER ??
      LLM_CONFIG.DEFAULT_PROVIDER) as ProviderName;
    const keyVar =
      provider === "deepseek"
        ? "DEEPSEEK_API_KEY"
        : provider === "gemini"
          ? "GEMINI_API_KEY"
          : "ANTHROPIC_API_KEY";
    const apiKey = process.env[keyVar];
    if (!apiKey) {
      throw new Error(
        `Missing ${keyVar} for provider "${provider}". Set it with: npx convex env set ${keyVar} <key>`,
      );
    }
    const model = process.env.LLM_MODEL ?? PROVIDER_DEFAULTS[provider].model;
    const client = createClient(provider, { apiKey });

    return await runTickLLMHandler(
      {
        load: async () => {
          // Annotate the runQuery result explicitly to break the circular
          // `api` type inference described above.
          const tickCtx: {
            billId: Id<"bills">;
            bill: Doc<"bills">;
            agents: Doc<"agents">[];
          } = await ctx.runQuery(api.queries.getTickContext, {
            sessionId: args.sessionId,
          });
          return tickCtx;
        },
        record: async (d) => {
          const llmCall = { ...d.llmCall };
          if (llmCall.errorKind === undefined) delete llmCall.errorKind;
          await ctx.runMutation(api.recordDecision.recordDecision, {
            sessionId: d.sessionId as Id<"sessions">,
            billId: d.billId as Id<"bills">,
            agentId: d.agentId as Id<"agents">,
            vote: d.vote,
            reasoning: d.reasoning,
            llmCall,
          });
        },
      },
      { sessionId: args.sessionId, client, model },
    );
  },
});
