import { formatCost } from "./observatory.helpers";

type StanceVector = { economic: number; environment: number; social: number };

type Agent = {
  _id: string;
  name: string;
  factionId: string;
  stanceVector: StanceVector;
  profileRef: string;
  opinionState: number;
};

type Bill = {
  _id: string;
  number: string;
  title: string;
  status: string;
  stanceVector: StanceVector;
  articles: { articleNo: number; text: string; tags: string[] }[];
  actualVotes?: { agentId: string; vote: string; sourceUrl: string }[];
};

type BillVote = {
  _id: string;
  sessionId: string;
  billId: string;
  agentId: string;
  vote: "yes" | "no" | "abstain";
  reasoning: string;
};

type LlmCallLogEntry = {
  costUsd: number;
};

export type ObservatoryProps = {
  agents: Agent[] | undefined;
  bills: Bill[] | undefined;
  billVotes: BillVote[] | undefined;
  llmCallLog: LlmCallLogEntry[] | undefined;
};

export default function Observatory({
  agents,
  bills,
  billVotes,
  llmCallLog,
}: ObservatoryProps) {
  const totalCost = (llmCallLog ?? []).reduce(
    (sum, entry) => sum + entry.costUsd,
    0,
  );

  return (
    <div style={{ padding: "1rem", fontFamily: "sans-serif" }}>
      <h1>Observatory</h1>

      <section data-testid="agent-list">
        <h2>Agents</h2>
        {agents === undefined ? (
          <p>Loading...</p>
        ) : agents.length === 0 ? (
          <p>No agents found. Run seed action first.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Faction</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => (
                <tr key={agent._id}>
                  <td>{agent.name}</td>
                  <td>{agent.factionId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section data-testid="bill-status">
        <h2>Bills</h2>
        {bills === undefined ? (
          <p>Loading...</p>
        ) : bills.length === 0 ? (
          <p>No bills found.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Number</th>
                <th>Title</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {bills.map((bill) => (
                <tr key={bill._id}>
                  <td>{bill.number}</td>
                  <td>{bill.title}</td>
                  <td>{bill.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section data-testid="vote-results">
        <h2>Vote Results</h2>
        {billVotes === undefined ? (
          <p>Loading...</p>
        ) : billVotes.length === 0 ? (
          <p>No votes recorded yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Agent</th>
                <th>Vote</th>
                <th>Reasoning</th>
              </tr>
            </thead>
            <tbody>
              {billVotes.map((bv) => {
                const agent = agents?.find((a) => a._id === bv.agentId);
                return (
                  <tr key={bv._id}>
                    <td>{agent?.name ?? bv.agentId}</td>
                    <td>{bv.vote}</td>
                    <td>{bv.reasoning}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section data-testid="cost-summary">
        <h2>LLM Cost Summary</h2>
        <p>
          Total cost: <strong>{formatCost(totalCost)}</strong>
        </p>
      </section>
    </div>
  );
}
