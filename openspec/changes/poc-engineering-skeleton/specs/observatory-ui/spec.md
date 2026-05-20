## ADDED Requirements

### Requirement: ConvexProvider setup
The app SHALL wrap the React root with ConvexProvider connected to the Convex deployment.

#### Scenario: App mounts with Convex
- **WHEN** the app starts via `npm run dev`
- **THEN** the React app SHALL render with a live Convex connection

### Requirement: Observatory page displays agent list
The Observatory page SHALL display a list of all agents with their name and factionId.

#### Scenario: 5 agents seeded
- **WHEN** 5 agents exist in the database
- **THEN** the Observatory page SHALL show 5 agent entries with name and faction

### Requirement: Observatory page displays bill status
The Observatory page SHALL display bills with their title, number, and current status.

#### Scenario: 1 bill in voting
- **WHEN** a bill with status "voting" exists
- **THEN** the Observatory page SHALL show the bill with status "voting"

### Requirement: Observatory page displays vote results
The Observatory page SHALL display vote results per agent after a session ends.

#### Scenario: Session completed with votes
- **WHEN** a session has ended and 5 billVotes exist
- **THEN** the Observatory page SHALL show each agent's vote (yes/no/abstain)

### Requirement: Observatory page displays cost summary
The Observatory page SHALL display total LLM cost from llmCallLog (sum of costUsd).

#### Scenario: No LLM calls yet (Phase A)
- **WHEN** llmCallLog is empty
- **THEN** the cost summary SHALL show $0.00
