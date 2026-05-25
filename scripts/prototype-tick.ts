#!/usr/bin/env node
// PROTOTYPE — throwaway TUI for exploring the tick simulation logic.
// Question: Does the dot-product-sign rule produce sensible voting outcomes,
// and how does match rate shift as we tweak stance vectors?
//
// Run: npm run proto:tick

import * as readline from "node:readline";
import { dotProduct, decideVote, type StanceVector, type Vote } from "../convex/lib/decisionLogic.ts";
import { AGENTS, BILL } from "../convex/lib/seedData.ts";

// ── In-memory state ──────────────────────────────────────────────

type Agent = {
  id: number;
  name: string;
  profileRef: string;
  factionId: string;
  stanceVector: StanceVector;
};

type Bill = {
  title: string;
  stanceVector: StanceVector;
  actualVotes: readonly { agentId: string; vote: string }[];
};

type SimVote = {
  agentName: string;
  profileRef: string;
  vote: Vote;
  score: number;
  actualVote: string | undefined;
  match: boolean;
};

type State = {
  agents: Agent[];
  bill: Bill;
  votes: SimVote[];
  selectedAgent: number; // index into agents
  selectedAxis: number;  // 0=economic 1=environment 2=social
  editingBill: boolean;  // false=editing agent, true=editing bill
};

const AXES: (keyof StanceVector)[] = ["economic", "environment", "social"];

function initState(): State {
  const agents: Agent[] = AGENTS.map((a, i) => ({
    id: i,
    name: a.name,
    profileRef: a.profileRef,
    factionId: a.factionId,
    stanceVector: { ...a.stanceVector },
  }));

  const bill: Bill = {
    title: BILL.title,
    stanceVector: { ...BILL.stanceVector },
    actualVotes: BILL.actualVotes,
  };

  return {
    agents,
    bill,
    votes: [],
    selectedAgent: 0,
    selectedAxis: 0,
    editingBill: false,
  };
}

// ── Simulation (pure) ────────────────────────────────────────────

function runSim(state: State): SimVote[] {
  return state.agents.map((agent) => {
    const score = dotProduct(agent.stanceVector, state.bill.stanceVector);
    const vote = decideVote(agent.stanceVector, state.bill.stanceVector);
    const actual = state.bill.actualVotes.find(
      (v) => v.agentId === agent.profileRef,
    );
    return {
      agentName: agent.name,
      profileRef: agent.profileRef,
      vote,
      score,
      actualVote: actual?.vote,
      match: actual ? actual.vote === vote : false,
    };
  });
}

// ── Rendering ────────────────────────────────────────────────────

const B = "\x1b[1m";   // bold
const D = "\x1b[2m";   // dim
const R = "\x1b[0m";   // reset
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const BG_CYAN = "\x1b[46m\x1b[30m";

function voteColor(v: string): string {
  if (v === "yes") return GREEN;
  if (v === "no") return RED;
  return YELLOW;
}

function fmtVec(v: StanceVector): string {
  return `eco=${v.economic.toFixed(1)} env=${v.environment.toFixed(1)} soc=${v.social.toFixed(1)}`;
}

function render(state: State): void {
  console.clear();

  // Header
  console.log(`${B}── TICK SIMULATION PROTOTYPE ──${R}\n`);

  // Bill
  console.log(`${B}Bill:${R} ${state.bill.title}`);
  const billVecParts = AXES.map((axis, i) => {
    const val = state.bill.stanceVector[axis].toFixed(1);
    if (state.editingBill && i === state.selectedAxis) {
      return `${BG_CYAN}${axis}=${val}${R}`;
    }
    return `${axis}=${val}`;
  });
  console.log(`  ${D}stance:${R} ${billVecParts.join("  ")}${state.editingBill ? `  ${CYAN}← editing bill${R}` : ""}\n`);

  // Agents
  console.log(`${B}Agents:${R}`);
  state.agents.forEach((agent, i) => {
    const sel = !state.editingBill && i === state.selectedAgent;
    const prefix = sel ? `${CYAN}▸${R}` : " ";
    const faction = `${D}[${agent.factionId}]${R}`;
    const vecParts = AXES.map((axis, ai) => {
      const val = agent.stanceVector[axis].toFixed(1);
      if (sel && ai === state.selectedAxis) {
        return `${BG_CYAN}${axis}=${val}${R}`;
      }
      return `${axis}=${val}`;
    });
    console.log(`${prefix} ${agent.name} ${faction}  ${vecParts.join("  ")}`);
  });

  // Votes
  if (state.votes.length > 0) {
    console.log(`\n${B}Votes:${R}`);
    let matchCount = 0;
    let total = 0;
    for (const v of state.votes) {
      const vc = voteColor(v.vote);
      const ac = v.actualVote ? voteColor(v.actualVote) : "";
      const matchStr = v.actualVote
        ? v.match
          ? `${GREEN}✓${R}`
          : `${RED}✗${R}`
        : `${D}?${R}`;
      console.log(
        `  ${v.agentName}  ${vc}${v.vote.padEnd(7)}${R}  ${D}score=${v.score.toFixed(4)}${R}  actual=${ac}${v.actualVote ?? "?"}${R}  ${matchStr}`,
      );
      if (v.actualVote) {
        total++;
        if (v.match) matchCount++;
      }
    }
    const rate = total === 0 ? 0 : matchCount / total;
    const rateColor = rate >= 0.8 ? GREEN : rate >= 0.5 ? YELLOW : RED;
    console.log(
      `\n  ${B}Match rate:${R} ${rateColor}${matchCount}/${total} (${(rate * 100).toFixed(0)}%)${R}`,
    );
  }

  // Controls
  console.log(`\n${D}─── controls ───${R}`);
  console.log(
    `${B}↑/↓${R} ${D}select agent${R}  ${B}←/→${R} ${D}select axis${R}  ${B}+/-${R} ${D}adjust ±0.1${R}  ${B}b${R} ${D}toggle bill/agent edit${R}`,
  );
  console.log(
    `${B}space${R} ${D}run tick${R}  ${B}r${R} ${D}reset stances${R}  ${B}z${R} ${D}zero selected${R}  ${B}q${R} ${D}quit${R}`,
  );
}

// ── Input handling ───────────────────────────────────────────────

function clamp(n: number): number {
  return Math.round(Math.max(-1, Math.min(1, n)) * 10) / 10;
}

function getEditTarget(state: State): StanceVector {
  return state.editingBill
    ? state.bill.stanceVector
    : state.agents[state.selectedAgent].stanceVector;
}

function handleKey(key: Buffer, state: State): boolean {
  const seq = key.toString();

  // Arrow keys
  if (seq === "\x1b[A") {
    // up
    if (!state.editingBill) {
      state.selectedAgent = Math.max(0, state.selectedAgent - 1);
    }
  } else if (seq === "\x1b[B") {
    // down
    if (!state.editingBill) {
      state.selectedAgent = Math.min(state.agents.length - 1, state.selectedAgent + 1);
    }
  } else if (seq === "\x1b[D") {
    // left
    state.selectedAxis = Math.max(0, state.selectedAxis - 1);
  } else if (seq === "\x1b[C") {
    // right
    state.selectedAxis = Math.min(2, state.selectedAxis + 1);
  } else if (seq === "+" || seq === "=") {
    const target = getEditTarget(state);
    target[AXES[state.selectedAxis]] = clamp(target[AXES[state.selectedAxis]] + 0.1);
    state.votes = runSim(state);
  } else if (seq === "-") {
    const target = getEditTarget(state);
    target[AXES[state.selectedAxis]] = clamp(target[AXES[state.selectedAxis]] - 0.1);
    state.votes = runSim(state);
  } else if (seq === " ") {
    state.votes = runSim(state);
  } else if (seq === "b") {
    state.editingBill = !state.editingBill;
  } else if (seq === "z") {
    const target = getEditTarget(state);
    target[AXES[state.selectedAxis]] = 0;
    state.votes = runSim(state);
  } else if (seq === "r") {
    const fresh = initState();
    state.agents = fresh.agents;
    state.bill = fresh.bill;
    state.votes = [];
    state.selectedAgent = 0;
    state.selectedAxis = 0;
    state.editingBill = false;
  } else if (seq === "q" || seq === "\x03") {
    return false;
  }

  return true;
}

// ── Main ─────────────────────────────────────────────────────────

function main(): void {
  const state = initState();

  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }

  render(state);

  process.stdin.on("keypress", (_str: string, key: readline.Key) => {
    if (!key) return;

    // Build a buffer-like representation for handleKey
    let seq: string;
    if (key.sequence) {
      seq = key.sequence;
    } else if (key.name === "space") {
      seq = " ";
    } else if (key.name === "return") {
      seq = "\n";
    } else {
      seq = key.sequence ?? "";
    }

    const cont = handleKey(Buffer.from(seq), state);
    if (!cont) {
      console.clear();
      console.log("Bye.");
      process.exit(0);
    }
    render(state);
  });
}

main();
