## ADDED Requirements

### Requirement: Agents table
The system SHALL define an `agents` table with fields: name (string), profileRef (string), stanceVector ({economic, environment, social} each number -1~1), factionId (string), opinionState (number -1~1).

#### Scenario: Agent record stores stance vector
- **WHEN** an agent record is created with stanceVector {economic: 0.8, environment: -0.3, social: 0.5}
- **THEN** the record SHALL persist all three dimensions as numbers

### Requirement: Bills table
The system SHALL define a `bills` table with fields: number (string), title (string), articles (array of {articleNo, text, tags[]}), stanceVector ({economic, environment, social}), status (string enum: "introduced" | "in_committee" | "voting" | "passed" | "rejected").

#### Scenario: Bill with articles
- **WHEN** a bill is created with 3 articles
- **THEN** the articles array SHALL contain 3 objects each with articleNo, text, and tags

### Requirement: Sessions table
The system SHALL define a `sessions` table with fields: startedAt (number), endedAt (optional number), seed (number), billsInScope (array of bill IDs).

#### Scenario: Session creation with seed
- **WHEN** a session is created with seed 42
- **THEN** the seed field SHALL be 42 and endedAt SHALL be undefined

### Requirement: BillVotes table
The system SHALL define a `billVotes` table with fields: sessionId, billId, agentId, vote (string enum: "yes" | "no" | "abstain"), reasoning (string), llmCallId (optional).

#### Scenario: Vote record links to session and agent
- **WHEN** a vote is recorded
- **THEN** it SHALL reference valid sessionId, billId, and agentId

### Requirement: LlmCallLog table
The system SHALL define an `llmCallLog` table with fields: agentId, action (string), model (string), promptTokens (number), completionTokens (number), costUsd (number), latencyMs (number), ok (boolean), errorKind (optional string).

#### Scenario: Failed LLM call logging
- **WHEN** an LLM call fails with errorKind "hallucinated_reference"
- **THEN** the record SHALL have ok=false and errorKind="hallucinated_reference"

### Requirement: Placeholder tables
The system SHALL define empty tables for `mediaOutlets`, `newsItems`, and `externalEvents` with minimal schema, reserved for future use.

#### Scenario: Placeholder tables exist
- **WHEN** the Convex schema is deployed
- **THEN** mediaOutlets, newsItems, and externalEvents tables SHALL exist in the database
