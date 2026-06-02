import { mutation } from "./_generated/server";
import { v } from "convex/values";

// Creates a session whose scope is every seeded bill (PoC = 1 bill). Mirrors the
// in-memory session setup the Phase A e2e test builds by hand; needed to drive a
// real LLM run (poc-plan §4.3, task 7). Seed defaults to 748 (釋字第748號).
export const startSession = mutation({
  args: { seed: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const bills = await ctx.db.query("bills").collect();
    if (bills.length === 0) {
      throw new Error("No bills seeded — run `npx convex run seed:seed` first.");
    }
    const sessionId = await ctx.db.insert("sessions", {
      startedAt: Date.now(),
      seed: args.seed ?? 748,
      billsInScope: bills.map((b) => b._id),
    });
    return { sessionId, billsInScope: bills.length };
  },
});
