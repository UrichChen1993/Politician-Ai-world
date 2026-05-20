import test from "node:test";
import assert from "node:assert/strict";

test("rng returns the same sequence for the same seed", async () => {
  const { rng } = await import("../convex/lib/rng.ts");

  const first = rng(42);
  const second = rng(42);

  assert.deepEqual(
    [first(), first(), first(), first()],
    [second(), second(), second(), second()],
  );
});

test("rng values stay in the half-open range [0, 1)", async () => {
  const { rng } = await import("../convex/lib/rng.ts");

  const random = rng(7);

  for (let i = 0; i < 100; i += 1) {
    const value = random();
    assert.ok(value >= 0);
    assert.ok(value < 1);
  }
});

test("decideVote returns yes, no, or abstain from stance-vector dot product", async () => {
  const { decideVote } = await import("../convex/decideOnce.ts");
  const bill = { economic: 0.6, environment: 0.4, social: 0.2 };

  assert.equal(
    decideVote({ economic: 0.8, environment: 0.5, social: 0.3 }, bill),
    "yes",
  );
  assert.equal(
    decideVote({ economic: -0.8, environment: -0.5, social: 0.1 }, bill),
    "no",
  );
  assert.equal(
    decideVote({ economic: 0.2, environment: -0.3, social: 0 }, {
      economic: 0.6,
      environment: 0.4,
      social: 1,
    }),
    "abstain",
  );
});

test("recordVoteHandler inserts a billVotes record", async () => {
  const { recordVoteHandler } = await import("../convex/recordVote.ts");
  const inserted = [];
  const ctx = {
    db: {
      insert: async (table, doc) => {
        inserted.push({ table, doc });
        return "vote-1";
      },
    },
  };

  const id = await recordVoteHandler(ctx, {
    sessionId: "session-1",
    billId: "bill-1",
    agentId: "agent-1",
    vote: "yes",
    reasoning: "stance alignment",
  });

  assert.equal(id, "vote-1");
  assert.deepEqual(inserted, [
    {
      table: "billVotes",
      doc: {
        sessionId: "session-1",
        billId: "bill-1",
        agentId: "agent-1",
        vote: "yes",
        reasoning: "stance alignment",
      },
    },
  ]);
});

test("runTickHandler records one vote per agent for the first bill in scope", async () => {
  const { runTickHandler } = await import("../convex/runTick.ts");
  const inserted = [];
  const agents = Array.from({ length: 5 }, (_, index) => ({
    _id: `agent-${index + 1}`,
    stanceVector: { economic: index < 4 ? 1 : -1, environment: 0, social: 0 },
  }));
  const ctx = {
    db: {
      get: async (id) => {
        if (id === "session-1") {
          return { _id: id, billsInScope: ["bill-1"] };
        }
        if (id === "bill-1") {
          return { _id: id, stanceVector: { economic: 1, environment: 0, social: 0 } };
        }
        return undefined;
      },
      query: (table) => {
        assert.equal(table, "agents");
        return { collect: async () => agents };
      },
      insert: async (table, doc) => {
        inserted.push({ table, doc });
        return `vote-${inserted.length}`;
      },
    },
  };

  const result = await runTickHandler(ctx, { sessionId: "session-1" });

  assert.equal(result.decisions, 5);
  assert.equal(inserted.length, 5);
  assert.deepEqual(
    inserted.map(({ doc }) => doc.vote),
    ["yes", "yes", "yes", "yes", "no"],
  );
});

test("endSessionHandler marks a session ended and reports ground-truth match rate", async () => {
  const { endSessionHandler } = await import("../convex/endSession.ts");
  const patches = [];
  const simulatedVotes = ["yes", "yes", "no", "abstain", "no"].map((vote, index) => ({
    agentId: `agent-${index + 1}`,
    billId: "bill-1",
    vote,
  }));
  const actualVotes = ["yes", "yes", "no", "yes", "no"].map((vote, index) => ({
    agentId: `agent-${index + 1}`,
    vote,
    sourceUrl: "https://example.test/vote",
  }));
  const ctx = {
    db: {
      get: async (id) => {
        if (id === "session-1") {
          return { _id: id, billsInScope: ["bill-1"] };
        }
        if (id === "bill-1") {
          return { _id: id, actualVotes };
        }
        return undefined;
      },
      patch: async (id, doc) => {
        patches.push({ id, doc });
      },
      query: (table) => {
        assert.equal(table, "billVotes");
        return {
          collect: async () => simulatedVotes,
        };
      },
    },
  };

  const result = await endSessionHandler(ctx, { sessionId: "session-1" });

  assert.equal(patches.length, 1);
  assert.equal(patches[0].id, "session-1");
  assert.equal(typeof patches[0].doc.endedAt, "number");
  assert.deepEqual(result, { matchCount: 4, total: 5, matchRate: 0.8 });
});
