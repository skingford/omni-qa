## ADDED Requirements

### Requirement: Generate test cases for selected endpoints
The system SHALL generate structured API test cases for user-selected endpoints using an AI provider adapter.

#### Scenario: Generate cases for a saved selection
- **WHEN** a user requests AI generation for a saved endpoint selection
- **THEN** the system creates a generation job and produces test cases associated with the selected endpoints

#### Scenario: Empty selection is rejected
- **WHEN** a user requests AI generation without any selected endpoints
- **THEN** the system rejects the request with a validation error

### Requirement: Use structured test case DSL
The system SHALL store generated test cases as validated JSON DSL containing request data, assertions, endpoint references, scenario metadata, model name, and prompt version.

#### Scenario: Valid AI output is stored
- **WHEN** the AI provider returns valid test case DSL
- **THEN** the system stores the generated cases and links them to their endpoints

#### Scenario: Invalid AI output is rejected
- **WHEN** the AI provider returns malformed JSON or unsupported assertion types
- **THEN** the system marks the generation job as failed and does not store invalid cases

### Requirement: Prevent executable code generation
The system SHALL NOT execute arbitrary code returned by AI and SHALL only execute validated DSL through controlled adapters.

#### Scenario: AI returns executable code
- **WHEN** the AI provider returns TypeScript, JavaScript, shell commands, or other executable text instead of DSL
- **THEN** the system rejects the output and records a validation failure

### Requirement: Build bounded prompts from endpoint context
The system SHALL construct AI prompts from selected endpoint metadata, schemas, examples, and generation policy while enforcing prompt size limits.

#### Scenario: Prompt context is bounded
- **WHEN** selected endpoints produce context larger than the configured prompt limit
- **THEN** the system truncates or batches context without losing endpoint identifiers

### Requirement: Redact sensitive values
The system SHALL redact sensitive field names and values before sending endpoint examples or prior results to an AI provider.

#### Scenario: Sensitive examples are redacted
- **WHEN** imported examples contain fields such as password, token, authorization, secret, or cookie
- **THEN** the system replaces sensitive values before prompt construction and persistence

### Requirement: Support deterministic fallback cases
The system SHALL be able to create basic deterministic smoke cases when AI generation is unavailable or disabled.

#### Scenario: AI provider unavailable
- **WHEN** the configured AI provider is unavailable and fallback is enabled
- **THEN** the system creates basic smoke test cases using OpenAPI examples and response status expectations
