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
  const { decideVote } = await import("../convex/lib/decisionLogic.ts");
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
  const { recordVoteHandler } = await import("../convex/lib/recordVoteHandler.ts");
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
  const { runTickHandler } = await import("../convex/lib/runTickHandler.ts");
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
  const { endSessionHandler } = await import("../convex/lib/endSessionHandler.ts");
  const patches = [];
  const agents = Array.from({ length: 5 }, (_, i) => ({
    _id: `agent-${i + 1}`,
    profileRef: `agent-${i + 1}`,
  }));
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
        if (table === "agents") return { collect: async () => agents };
        if (table === "billVotes") return { collect: async () => simulatedVotes };
        throw new Error(`Unexpected table: ${table}`);
      },
    },
  };

  const result = await endSessionHandler(ctx, { sessionId: "session-1" });

  assert.equal(patches.length, 1);
  assert.equal(patches[0].id, "session-1");
  assert.equal(typeof patches[0].doc.endedAt, "number");
  assert.deepEqual(result, { matchCount: 4, total: 5, matchRate: 0.8 });
});

test("Phase A end-to-end: seed → runTick → endSession with real ground-truth data → 5/5 match", async () => {
  const { AGENTS, BILL } = await import("../convex/lib/seedData.ts");
  const { runTickHandler } = await import("../convex/lib/runTickHandler.ts");
  const { endSessionHandler } = await import("../convex/lib/endSessionHandler.ts");

  // In-memory DB
  const store = { agents: [], bills: [], sessions: [], billVotes: [] };
  let idCounter = 0;
  const nextId = (prefix) => `${prefix}-${++idCounter}`;

  // Seed
  const agentIds = [];
  for (const a of AGENTS) {
    const id = nextId("agent");
    store.agents.push({ _id: id, ...a });
    agentIds.push(id);
  }
  const billId = nextId("bill");
  store.bills.push({ _id: billId, ...BILL });

  // Start session
  const sessionId = nextId("session");
  store.sessions.push({
    _id: sessionId,
    startedAt: Date.now(),
    seed: 748,
    billsInScope: [billId],
  });

  // Mock DB
  const db = {
    get: async (id) => {
      for (const t of [store.sessions, store.bills, store.agents]) {
        const found = t.find((r) => r._id === id);
        if (found) return found;
      }
      return undefined;
    },
    query: (table) => ({
      collect: async () => store[table === "billVotes" ? "billVotes" : table] ?? [],
    }),
    insert: async (table, doc) => {
      const id = nextId(table);
      const record = { _id: id, ...doc };
      if (table === "billVotes") store.billVotes.push(record);
      return id;
    },
    patch: async (id, patch) => {
      for (const t of [store.sessions, store.bills, store.agents]) {
        const found = t.find((r) => r._id === id);
        if (found) Object.assign(found, patch);
      }
    },
  };

  // Run tick
  const tickResult = await runTickHandler({ db }, { sessionId });
  assert.equal(tickResult.decisions, 5, "Should have 5 decisions");
  assert.equal(store.billVotes.length, 5, "Should have 5 vote records");

  // End session
  const endResult = await endSessionHandler({ db }, { sessionId });

  // Verify
  assert.equal(endResult.total, 5, "Should compare 5 votes");
  assert.equal(endResult.matchCount, 5, "All 5 votes should match ground truth");
  assert.equal(endResult.matchRate, 1.0, "Match rate should be 100%");

  // Log details for visibility
  const { decideVote, dotProduct } = await import("../convex/lib/decisionLogic.ts");
  for (const agent of store.agents) {
    const score = dotProduct(agent.stanceVector, store.bills[0].stanceVector);
    const predicted = decideVote(agent.stanceVector, store.bills[0].stanceVector);
    const actual = BILL.actualVotes.find((v) => v.agentId === agent.profileRef);
    console.log(
      `  ${agent.name}: dot=${score.toFixed(2)} → ${predicted} (actual: ${actual?.vote}) ${predicted === actual?.vote ? "✓" : "✗"}`,
    );
  }
});
