import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { endSessionHandler } from "./lib/endSessionHandler.ts";

export { endSessionHandler } from "./lib/endSessionHandler.ts";

export const endSession = mutation({
  args: {
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args) =>
    await endSessionHandler(ctx as Parameters<typeof endSessionHandler>[0], args),
});
