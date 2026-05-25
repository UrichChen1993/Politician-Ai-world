import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { runTickHandler } from "./lib/runTickHandler.ts";

export { runTickHandler } from "./lib/runTickHandler.ts";

export const runTick = mutation({
  args: {
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    try {
      return await runTickHandler(ctx as Parameters<typeof runTickHandler>[0], args);
    } catch (err) {
      console.error("[runTick] failed", {
        sessionId: args.sessionId,
        error: err instanceof Error ? { message: err.message, stack: err.stack } : err,
      });
      throw err;
    }
  },
});
