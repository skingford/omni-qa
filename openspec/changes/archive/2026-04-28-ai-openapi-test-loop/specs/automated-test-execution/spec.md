## ADDED Requirements

### Requirement: Execute generated API test cases
The system SHALL execute validated API test case DSL through a controlled execution adapter and create a test run record.

#### Scenario: Start test run
- **WHEN** a user starts a run for generated test cases and a target environment
- **THEN** the system creates a test run and begins execution asynchronously

#### Scenario: Reject run without cases
- **WHEN** a user starts a run without any enabled test cases
- **THEN** the system rejects the request with a validation error

### Requirement: Reuse existing Playwright execution capabilities
The system SHALL support a Playwright execution adapter that preserves existing omni-qa environment, authentication, retry, trace, and report behavior.

#### Scenario: Execute through Playwright
- **WHEN** a test run starts with the Playwright adapter
- **THEN** the system generates controlled runtime specs or equivalent execution artifacts and invokes Playwright with the selected environment

### Requirement: Capture per-case results
The system SHALL store per-case execution results including status, duration, assertion failures, error message, response status, and report references.

#### Scenario: Case fails assertion
- **WHEN** a test case assertion fails during execution
- **THEN** the system records the failure with the case identifier and assertion details

#### Scenario: Case passes
- **WHEN** all assertions for a test case pass
- **THEN** the system records the case as passed with duration and response status

### Requirement: Expose run status and report links
The system SHALL expose test run status, summary counts, execution timing, output preview, and report paths through API endpoints.

#### Scenario: Read running status
- **WHEN** a user requests a running test run
- **THEN** the system returns current status, started time, and available progress summary

#### Scenario: Read completed report
- **WHEN** a user requests a completed test run report
- **THEN** the system returns report preview metadata and links to available report artifacts

### Requirement: Bound execution concurrency
The system SHALL enforce configured limits for concurrent runs, worker count, request timeout, and per-run case count.

#### Scenario: Concurrent run limit reached
- **WHEN** the maximum number of concurrent runs is already active
- **THEN** the system keeps new runs queued or rejects them according to configuration

### Requirement: Support cancellation
The system SHALL allow users or shutdown handling to cancel queued or running jobs when the execution adapter supports cancellation.

#### Scenario: Cancel running test run
- **WHEN** a user cancels a running test run
- **THEN** the system signals the execution adapter, stops further case execution, and records the run as canceled
