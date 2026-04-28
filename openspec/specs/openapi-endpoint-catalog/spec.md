# openapi-endpoint-catalog Specification

## Purpose
TBD - created by archiving change ai-openapi-test-loop. Update Purpose after archive.
## Requirements
### Requirement: Import OpenAPI document from URL
The system SHALL allow a user to submit an HTTP or HTTPS OpenAPI/Swagger document URL and create an asynchronous import job.

#### Scenario: Valid URL import starts
- **WHEN** a user submits a valid OpenAPI document URL
- **THEN** the system creates an import job and returns a job identifier

#### Scenario: Invalid URL is rejected
- **WHEN** a user submits an empty URL, unsupported scheme, or malformed URL
- **THEN** the system rejects the request with a validation error and does not create an import job

### Requirement: Normalize imported API endpoints
The system SHALL parse imported OpenAPI/Swagger documents into normalized endpoint records containing method, path, operation id, summary, tags, parameters, request body, and responses.

#### Scenario: OpenAPI paths are normalized
- **WHEN** an import job successfully parses a document with paths and operations
- **THEN** the system persists one endpoint record for each supported HTTP operation

#### Scenario: Empty API document fails
- **WHEN** an import job parses a document with no supported endpoints
- **THEN** the system marks the import job as failed with a clear error message

### Requirement: Track imported API spec metadata
The system SHALL persist imported spec metadata including source URL, title, version, base URL, content hash, imported time, and endpoint count.

#### Scenario: Import metadata is available
- **WHEN** an import job succeeds
- **THEN** the imported spec can be listed with title, version, source URL, imported time, and endpoint count

### Requirement: List and filter selectable endpoints
The system SHALL expose imported endpoints for UI selection and support filtering by tag, method, path, operation id, and keyword.

#### Scenario: Filter endpoints by tag
- **WHEN** a user filters endpoints by a tag
- **THEN** the system returns only endpoints containing that tag

#### Scenario: Search endpoints by keyword
- **WHEN** a user searches by a keyword matching path, summary, or operation id
- **THEN** the system returns matching endpoints with stable endpoint identifiers

### Requirement: Save endpoint selections
The system SHALL allow a user to submit a set of endpoint identifiers for later AI generation or execution.

#### Scenario: Save valid endpoint selection
- **WHEN** a user submits endpoint identifiers that belong to an imported spec
- **THEN** the system saves the selection and returns a selection identifier

#### Scenario: Reject unknown endpoint selection
- **WHEN** a user submits endpoint identifiers that do not exist for the spec
- **THEN** the system rejects the selection with a validation error

### Requirement: Bound import resource usage
The system SHALL enforce import limits for URL scheme, download size, parse duration, and maximum endpoint count.

#### Scenario: Oversized document is rejected
- **WHEN** an OpenAPI document exceeds the configured download size limit
- **THEN** the system fails the import job without persisting partial endpoints

