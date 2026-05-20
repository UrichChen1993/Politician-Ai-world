## ADDED Requirements

### Requirement: Seeded random number generator
The system SHALL provide an `rng(seed)` function that returns a deterministic pseudo-random number generator. Successive calls to the returned function SHALL produce the same sequence for the same seed.

#### Scenario: Same seed produces same sequence
- **WHEN** rng(42) is called twice independently
- **THEN** both instances SHALL produce identical sequences of numbers

#### Scenario: Output range
- **WHEN** the rng function is called
- **THEN** each returned value SHALL be in the range [0, 1)
