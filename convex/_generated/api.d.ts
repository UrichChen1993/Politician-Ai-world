/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as decideOnce from "../decideOnce.js";
import type * as endSession from "../endSession.js";
import type * as lib_queryHandlers from "../lib/queryHandlers.js";
import type * as lib_rng from "../lib/rng.js";
import type * as lib_seedData from "../lib/seedData.js";
import type * as queries from "../queries.js";
import type * as recordVote from "../recordVote.js";
import type * as runTick from "../runTick.js";
import type * as seed from "../seed.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  decideOnce: typeof decideOnce;
  endSession: typeof endSession;
  "lib/queryHandlers": typeof lib_queryHandlers;
  "lib/rng": typeof lib_rng;
  "lib/seedData": typeof lib_seedData;
  queries: typeof queries;
  recordVote: typeof recordVote;
  runTick: typeof runTick;
  seed: typeof seed;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
