## ADDED Requirements

### Requirement: Seed action loads ground truth data
The system SHALL provide a seed action that reads ground-truth data and inserts agents and bills into the Convex database.

#### Scenario: Seed with 5 placeholder politicians and 1 bill
- **WHEN** the seed action is executed
- **THEN** 5 agent records and 1 bill record SHALL be created in the database

### Requirement: Seed action is idempotent
The seed action SHALL clear existing agents and bills before inserting, to allow re-seeding without duplicates.

#### Scenario: Running seed twice
- **WHEN** seed is executed twice
- **THEN** the database SHALL contain exactly 5 agents and 1 bill (not 10 and 2)
