import test from "node:test";
import assert from "node:assert/strict";

test("seedHandler inserts 5 agents and 1 bill", async () => {
  const { seedHandler } = await import("../convex/lib/seedData.ts");
  const inserted = { agents: [], bills: [] };
  const ctx = {
    db: {
      query: (table) => ({
        collect: async () => [],
      }),
      insert: async (table, doc) => {
        if (table === "agents") {
          const id = `agent-${inserted.agents.length + 1}`;
          inserted.agents.push({ id, doc });
          return id;
        }
        if (table === "bills") {
          const id = `bill-${inserted.bills.length + 1}`;
          inserted.bills.push({ id, doc });
          return id;
        }
        throw new Error(`Unexpected table: ${table}`);
      },
      delete: async () => {},
    },
  };

  await seedHandler(ctx);

  assert.equal(inserted.agents.length, 5, "should insert 5 agents");
  assert.equal(inserted.bills.length, 1, "should insert 1 bill");

  for (const { doc } of inserted.agents) {
    assert.equal(typeof doc.name, "string", "agent should have a name");
    assert.equal(typeof doc.profileRef, "string", "agent should have a profileRef");
    assert.equal(typeof doc.factionId, "string", "agent should have a factionId");
    assert.equal(typeof doc.opinionState, "number", "agent should have opinionState");
    assert.ok(doc.stanceVector, "agent should have stanceVector");
    assert.equal(typeof doc.stanceVector.economic, "number");
    assert.equal(typeof doc.stanceVector.environment, "number");
    assert.equal(typeof doc.stanceVector.social, "number");
  }

  const bill = inserted.bills[0].doc;
  assert.equal(typeof bill.number, "string", "bill should have a number");
  assert.equal(typeof bill.title, "string", "bill should have a title");
  assert.ok(Array.isArray(bill.articles), "bill should have articles array");
  assert.ok(bill.stanceVector, "bill should have stanceVector");
  assert.equal(typeof bill.status, "string", "bill should have a status");
});

test("seedHandler is idempotent — clears existing data before inserting", async () => {
  const { seedHandler } = await import("../convex/lib/seedData.ts");

  const store = { agents: [], bills: [] };
  let deleteCount = 0;

  const makeCtx = () => ({
    db: {
      query: (table) => ({
        collect: async () => {
          if (table === "agents") return store.agents.map((a) => ({ _id: a.id }));
          if (table === "bills") return store.bills.map((b) => ({ _id: b.id }));
          return [];
        },
      }),
      insert: async (table, doc) => {
        if (table === "agents") {
          const id = `agent-${store.agents.length + 1}`;
          store.agents.push({ id, doc });
          return id;
        }
        if (table === "bills") {
          const id = `bill-${store.bills.length + 1}`;
          store.bills.push({ id, doc });
          return id;
        }
        throw new Error(`Unexpected table: ${table}`);
      },
      delete: async (id) => {
        deleteCount += 1;
        store.agents = store.agents.filter((a) => a.id !== id);
        store.bills = store.bills.filter((b) => b.id !== id);
      },
    },
  });

  // First run
  await seedHandler(makeCtx());
  assert.equal(store.agents.length, 5);
  assert.equal(store.bills.length, 1);

  // Second run — should clear then re-insert
  await seedHandler(makeCtx());
  assert.equal(store.agents.length, 5, "still 5 agents after second seed");
  assert.equal(store.bills.length, 1, "still 1 bill after second seed");
  assert.ok(deleteCount > 0, "should have deleted existing records");
});

test("seedHandler agents have distinct profileRef values", async () => {
  const { seedHandler } = await import("../convex/lib/seedData.ts");
  const agents = [];
  const ctx = {
    db: {
      query: (table) => ({ collect: async () => [] }),
      insert: async (table, doc) => {
        if (table === "agents") agents.push(doc);
        return `id-${agents.length}`;
      },
      delete: async () => {},
    },
  };

  await seedHandler(ctx);

  const profileRefs = agents.map((a) => a.profileRef);
  const unique = new Set(profileRefs);
  assert.equal(unique.size, 5, "all 5 agents should have distinct profileRef");
});

test("seedHandler bill has actualVotes referencing agent profileRefs", async () => {
  const { seedHandler } = await import("../convex/lib/seedData.ts");
  const agents = [];
  let bill = null;
  const ctx = {
    db: {
      query: (table) => ({ collect: async () => [] }),
      insert: async (table, doc) => {
        if (table === "agents") {
          agents.push(doc);
          return `agent-${agents.length}`;
        }
        if (table === "bills") {
          bill = doc;
          return "bill-1";
        }
        return "id";
      },
      delete: async () => {},
    },
  };

  await seedHandler(ctx);

  assert.ok(bill.actualVotes, "bill should have actualVotes for ground-truth comparison");
  assert.ok(Array.isArray(bill.actualVotes), "actualVotes should be an array");
  assert.equal(bill.actualVotes.length, 5, "actualVotes should have one entry per agent");

  const agentProfileRefs = new Set(agents.map((a) => a.profileRef));
  for (const av of bill.actualVotes) {
    assert.ok(agentProfileRefs.has(av.agentId), `actualVote agentId "${av.agentId}" should match an agent profileRef`);
    assert.ok(["yes", "no", "abstain", "absent"].includes(av.vote), `vote should be valid: ${av.vote}`);
    assert.equal(typeof av.sourceUrl, "string", "actualVote should have sourceUrl");
  }
});
