import { mutation } from "./_generated/server";
import { seedHandler } from "./lib/seedData.ts";

export { seedHandler };

export const seed = mutation({
  args: {},
  handler: async (ctx) => {
    return await seedHandler(ctx as Parameters<typeof seedHandler>[0]);
  },
});
