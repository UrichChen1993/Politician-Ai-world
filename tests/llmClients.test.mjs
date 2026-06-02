import test from "node:test";
import assert from "node:assert/strict";

const anthropic = await import("../convex/lib/llm/anthropicClient.ts");
const deepseek = await import("../convex/lib/llm/deepseekClient.ts");
const gemini = await import("../convex/lib/llm/geminiClient.ts");
const { createClient } = await import("../convex/lib/llm/createClient.ts");

const REQ = {
  system: "SYS",
  user: "USR",
  model: "m",
  maxTokens: 600,
  temperature: 0.3,
};

function fakeFetch(jsonBody, { ok = true, status = 200 } = {}) {
  const fn = async (url, init) => {
    fn.url = url;
    fn.init = init;
    return {
      ok,
      status,
      json: async () => jsonBody,
      text: async () => JSON.stringify(jsonBody),
    };
  };
  return fn;
}

test("anthropic body: system carries cache_control, user is a message", () => {
  const body = anthropic.buildAnthropicBody(REQ);
  assert.equal(body.model, "m");
  assert.equal(body.max_tokens, 600);
  assert.equal(body.system[0].text, "SYS");
  assert.deepEqual(body.system[0].cache_control, { type: "ephemeral" });
  assert.equal(body.messages[0].role, "user");
  assert.equal(body.messages[0].content, "USR");
});

test("anthropic response parse: joins text blocks + usage", () => {
  const parsed = anthropic.parseAnthropicResponse({
    model: "claude-haiku-4-5-20251001",
    content: [
      { type: "text", text: "AB" },
      { type: "text", text: "C" },
    ],
    usage: { input_tokens: 100, output_tokens: 7 },
  });
  assert.equal(parsed.text, "ABC");
  assert.equal(parsed.promptTokens, 100);
  assert.equal(parsed.completionTokens, 7);
});

test("anthropic client: hits messages endpoint with x-api-key, returns result", async () => {
  const fetchFn = fakeFetch({
    model: "claude-haiku-4-5-20251001",
    content: [{ type: "text", text: "hi" }],
    usage: { input_tokens: 10, output_tokens: 2 },
  });
  const client = anthropic.createAnthropicClient({ apiKey: "k", fetchFn });
  const r = await client(REQ);
  assert.equal(r.text, "hi");
  assert.equal(r.promptTokens, 10);
  assert.ok(fetchFn.url.includes("/v1/messages"));
  assert.equal(fetchFn.init.headers["x-api-key"], "k");
});

test("deepseek body: OpenAI-style system+user messages", () => {
  const body = deepseek.buildDeepseekBody(REQ);
  assert.equal(body.messages[0].role, "system");
  assert.equal(body.messages[0].content, "SYS");
  assert.equal(body.messages[1].role, "user");
});

test("deepseek response parse: choices[0].message.content + usage", () => {
  const parsed = deepseek.parseDeepseekResponse({
    model: "deepseek-chat",
    choices: [{ message: { content: "yo" } }],
    usage: { prompt_tokens: 50, completion_tokens: 9 },
  });
  assert.equal(parsed.text, "yo");
  assert.equal(parsed.promptTokens, 50);
  assert.equal(parsed.completionTokens, 9);
});

test("deepseek client: bearer auth, returns result", async () => {
  const fetchFn = fakeFetch({
    model: "deepseek-chat",
    choices: [{ message: { content: "ok" } }],
    usage: { prompt_tokens: 5, completion_tokens: 1 },
  });
  const client = deepseek.createDeepseekClient({ apiKey: "sk", fetchFn });
  const r = await client(REQ);
  assert.equal(r.text, "ok");
  assert.equal(fetchFn.init.headers.authorization, "Bearer sk");
});

test("gemini body: system_instruction + user contents + generationConfig", () => {
  const body = gemini.buildGeminiBody(REQ);
  assert.equal(body.system_instruction.parts[0].text, "SYS");
  assert.equal(body.contents[0].role, "user");
  assert.equal(body.contents[0].parts[0].text, "USR");
  assert.equal(body.generationConfig.maxOutputTokens, 600);
  assert.equal(body.generationConfig.temperature, 0.3);
  // Thinking disabled so 2.5-flash doesn't spend the output budget on thoughts.
  assert.equal(body.generationConfig.thinkingConfig.thinkingBudget, 0);
});

test("gemini response parse: candidates[0].content.parts + usageMetadata", () => {
  const parsed = gemini.parseGeminiResponse({
    modelVersion: "gemini-2.5-flash",
    candidates: [{ content: { parts: [{ text: "ha" }, { text: "i" }] } }],
    usageMetadata: { promptTokenCount: 80, candidatesTokenCount: 4 },
  });
  assert.equal(parsed.text, "hai");
  assert.equal(parsed.model, "gemini-2.5-flash");
  assert.equal(parsed.promptTokens, 80);
  assert.equal(parsed.completionTokens, 4);
});

test("gemini client: model in URL path, x-goog-api-key header, returns result", async () => {
  const fetchFn = fakeFetch({
    modelVersion: "gemini-2.5-flash",
    candidates: [{ content: { parts: [{ text: "ok" }] } }],
    usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 1 },
  });
  const client = gemini.createGeminiClient({ apiKey: "g", fetchFn });
  const r = await client({ ...REQ, model: "gemini-2.5-flash" });
  assert.equal(r.text, "ok");
  assert.equal(r.promptTokens, 5);
  assert.ok(fetchFn.url.includes("/models/gemini-2.5-flash:generateContent"));
  assert.equal(fetchFn.init.headers["x-goog-api-key"], "g");
});

test("client throws on non-ok HTTP", async () => {
  const fetchFn = fakeFetch({ error: "bad" }, { ok: false, status: 429 });
  const client = deepseek.createDeepseekClient({ apiKey: "sk", fetchFn });
  await assert.rejects(() => client(REQ), /429/);
});

test("createClient routes by provider name", () => {
  assert.equal(typeof createClient("anthropic", { apiKey: "k" }), "function");
  assert.equal(typeof createClient("deepseek", { apiKey: "k" }), "function");
  assert.equal(typeof createClient("gemini", { apiKey: "k" }), "function");
  assert.throws(() => createClient("unknown", { apiKey: "k" }));
});
