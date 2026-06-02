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
import type * as lib_decideOnceLLM from "../lib/decideOnceLLM.js";
import type * as lib_decisionLogic from "../lib/decisionLogic.js";
import type * as lib_decisionParse from "../lib/decisionParse.js";
import type * as lib_decisionPrompt from "../lib/decisionPrompt.js";
import type * as lib_endSessionHandler from "../lib/endSessionHandler.js";
import type * as lib_llm_anthropicClient from "../lib/llm/anthropicClient.js";
import type * as lib_llm_config from "../lib/llm/config.js";
import type * as lib_llm_cost from "../lib/llm/cost.js";
import type * as lib_llm_createClient from "../lib/llm/createClient.js";
import type * as lib_llm_deepseekClient from "../lib/llm/deepseekClient.js";
import type * as lib_llm_geminiClient from "../lib/llm/geminiClient.js";
import type * as lib_llm_http from "../lib/llm/http.js";
import type * as lib_llm_provider from "../lib/llm/provider.js";
import type * as lib_queryHandlers from "../lib/queryHandlers.js";
import type * as lib_recordDecisionHandler from "../lib/recordDecisionHandler.js";
import type * as lib_recordVoteHandler from "../lib/recordVoteHandler.js";
import type * as lib_referenceCheck from "../lib/referenceCheck.js";
import type * as lib_rng from "../lib/rng.js";
import type * as lib_runTickHandler from "../lib/runTickHandler.js";
import type * as lib_runTickLLMHandler from "../lib/runTickLLMHandler.js";
import type * as lib_seedData from "../lib/seedData.js";
import type * as queries from "../queries.js";
import type * as recordDecision from "../recordDecision.js";
import type * as recordVote from "../recordVote.js";
import type * as runTick from "../runTick.js";
import type * as runTickLLM from "../runTickLLM.js";
import type * as seed from "../seed.js";
import type * as startSession from "../startSession.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  decideOnce: typeof decideOnce;
  endSession: typeof endSession;
  "lib/decideOnceLLM": typeof lib_decideOnceLLM;
  "lib/decisionLogic": typeof lib_decisionLogic;
  "lib/decisionParse": typeof lib_decisionParse;
  "lib/decisionPrompt": typeof lib_decisionPrompt;
  "lib/endSessionHandler": typeof lib_endSessionHandler;
  "lib/llm/anthropicClient": typeof lib_llm_anthropicClient;
  "lib/llm/config": typeof lib_llm_config;
  "lib/llm/cost": typeof lib_llm_cost;
  "lib/llm/createClient": typeof lib_llm_createClient;
  "lib/llm/deepseekClient": typeof lib_llm_deepseekClient;
  "lib/llm/geminiClient": typeof lib_llm_geminiClient;
  "lib/llm/http": typeof lib_llm_http;
  "lib/llm/provider": typeof lib_llm_provider;
  "lib/queryHandlers": typeof lib_queryHandlers;
  "lib/recordDecisionHandler": typeof lib_recordDecisionHandler;
  "lib/recordVoteHandler": typeof lib_recordVoteHandler;
  "lib/referenceCheck": typeof lib_referenceCheck;
  "lib/rng": typeof lib_rng;
  "lib/runTickHandler": typeof lib_runTickHandler;
  "lib/runTickLLMHandler": typeof lib_runTickLLMHandler;
  "lib/seedData": typeof lib_seedData;
  queries: typeof queries;
  recordDecision: typeof recordDecision;
  recordVote: typeof recordVote;
  runTick: typeof runTick;
  runTickLLM: typeof runTickLLM;
  seed: typeof seed;
  startSession: typeof startSession;
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
