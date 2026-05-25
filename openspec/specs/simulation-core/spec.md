## ADDED Requirements

### Requirement: runTick advances simulation
The system SHALL provide a `runTick` function that takes a sessionId and calls `decideOnce` for each agent in the session's scope.

#### Scenario: Single tick with 5 agents
- **WHEN** runTick is called for a session with 5 agents and 1 bill in scope
- **THEN** decideOnce SHALL be invoked exactly 5 times, once per agent

### Requirement: decideOnce Phase A mock rule
The system SHALL provide a `decideOnce` function that in Phase A computes vote = sign(dot(agent.stanceVector, bill.stanceVector)). Positive → "yes", negative → "no", zero → "abstain".

#### Scenario: Agent agrees with bill
- **WHEN** agent stanceVector is {economic: 0.8, environment: 0.5, social: 0.3} and bill stanceVector is {economic: 0.6, environment: 0.4, social: 0.2}
- **THEN** dot product is positive (0.48+0.20+0.06=0.74) and vote SHALL be "yes"

#### Scenario: Agent opposes bill
- **WHEN** agent stanceVector is {economic: -0.8, environment: -0.5, social: 0.1} and bill stanceVector is {economic: 0.6, environment: 0.4, social: 0.2}
- **THEN** dot product is negative (-0.48-0.20+0.02=-0.66) and vote SHALL be "no"

### Requirement: recordVote persists vote
The system SHALL provide a `recordVote` function that writes a billVotes record with the agent's vote, reasoning, and optional llmCallId.

#### Scenario: Record a yes vote
- **WHEN** recordVote is called with agentId, billId, vote="yes", reasoning="stance alignment"
- **THEN** a new billVotes record SHALL be created with those values

### Requirement: endSession compares ground truth
The system SHALL provide an `endSession` function that marks the session as ended and compares simulated votes against ground truth actual votes, returning a match count.

#### Scenario: 4 of 5 votes match
- **WHEN** endSession is called and 4 agents' simulated votes match actualVotes
- **THEN** the function SHALL return matchCount=4, total=5, matchRate=0.8
