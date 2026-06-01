import test from "node:test";
import assert from "node:assert/strict";

const { decideOnceLLM } = await import("../convex/lib/decideOnceLLM.ts");

const AGENT = {
  name: "測試委員",
  factionId: "X",
  persona: "測試用側寫",
  stanceVector: { economic: 0.5, environment: 0.0, social: 0.9 },
};
const BILL = {
  number: "n-1",
  title: "測試法案",
  articles: [
    { articleNo: 2, text: "條文二" },
    { articleNo: 4, text: "條文四" },
  ],
  stanceVector: { economic: 0.0, environment: 0.0, social: 0.9 }, // dot=0.81 → "yes"
};
const MODEL = "claude-haiku-4-5-20251001";

// Fake client that replays queued responses. Each entry is either an LlmResult
// or a function (so a step can throw or hang).
function queuedClient(responses) {
  let i = 0;
  const fn = async (req) => {
    fn.calls.push(req);
    const entry = responses[Math.min(i, responses.length - 1)];
    i++;
    return typeof entry === "function" ? entry() : entry;
  };
  fn.calls = [];
  return fn;
}

const okResult = (text, pt = 6000, ct = 500) => ({
  text,
  model: MODEL,
  promptTokens: pt,
  completionTokens: ct,
});

test("happy path: valid response → source llm, ok true", async () => {
  const client = queuedClient([
    okResult('{"vote":"no","reasoning":"反對理由","citedArticles":[2]}'),
  ]);
  const r = await decideOnceLLM({ agent: AGENT, bill: BILL, client, model: MODEL });
  assert.equal(r.source, "llm");
  assert.equal(r.vote, "no");
  assert.equal(r.reasoning, "反對理由");
  assert.equal(r.llmCall.ok, true);
  assert.equal(r.llmCall.errorKind, undefined);
  assert.equal(client.calls.length, 1);
  assert.equal(r.llmCall.promptTokens, 6000);
  assert.equal(r.llmCall.costUsd, 0.0068); // 6000×0.8/M + 500×4/M
});

test("retry: bad JSON then good JSON → succeeds on 2nd attempt", async () => {
  const client = queuedClient([
    okResult("totally not json"),
    okResult('{"vote":"yes","reasoning":"ok","citedArticles":[]}'),
  ]);
  const r = await decideOnceLLM({ agent: AGENT, bill: BILL, client, model: MODEL });
  assert.equal(r.source, "llm");
  assert.equal(r.vote, "yes");
  assert.equal(client.calls.length, 2);
  // cost accumulates both attempts (we paid for both)
  assert.equal(r.llmCall.promptTokens, 12000);
});

test("schema failure twice → dot-product fallback", async () => {
  const client = queuedClient([okResult("nope"), okResult("still nope")]);
  const r = await decideOnceLLM({ agent: AGENT, bill: BILL, client, model: MODEL });
  assert.equal(r.source, "fallback");
  assert.equal(r.vote, "yes"); // dot product 0.81 > 0
  assert.equal(r.llmCall.ok, false);
  assert.equal(r.llmCall.errorKind, "schema_validation_failed");
  assert.ok(r.reasoning.includes("fallback"));
});

test("timeout → fallback with errorKind timeout", async () => {
  const hang = () => new Promise(() => {}); // never resolves
  const client = queuedClient([hang, hang]);
  const r = await decideOnceLLM({
    agent: AGENT,
    bill: BILL,
    client,
    model: MODEL,
    timeoutMs: 20,
  });
  assert.equal(r.source, "fallback");
  assert.equal(r.llmCall.ok, false);
  assert.equal(r.llmCall.errorKind, "timeout");
});

test("client throws → fallback with errorKind llm_request_failed", async () => {
  const boom = () => {
    throw new Error("network down");
  };
  const client = queuedClient([boom, boom]);
  const r = await decideOnceLLM({ agent: AGENT, bill: BILL, client, model: MODEL });
  assert.equal(r.source, "fallback");
  assert.equal(r.llmCall.errorKind, "llm_request_failed");
});

test("hallucinated reference is non-fatal: vote kept, ok true, tagged", async () => {
  const client = queuedClient([
    okResult('{"vote":"yes","reasoning":"引用不存在條文","citedArticles":[99]}'),
  ]);
  const r = await decideOnceLLM({ agent: AGENT, bill: BILL, client, model: MODEL });
  assert.equal(r.source, "llm");
  assert.equal(r.vote, "yes");
  assert.equal(r.llmCall.ok, true);
  assert.equal(r.llmCall.errorKind, "hallucinated_reference");
});
