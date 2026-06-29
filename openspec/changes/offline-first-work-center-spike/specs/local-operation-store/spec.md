# Local Operation Store Specification

## Purpose

Define the local-first operation store that lets the app record critical field actions offline, preserve an auditable signed outbox, and materialize local operational views before any backend sync exists.

## Requirements

### Requirement: Durable incident-scoped local data

The system MUST persist incident-scoped operational data locally so previously prepared incidents and cells remain usable without network access.

#### Scenario: Open prepared incident offline

- GIVEN an incident and its current cell were previously stored locally
- WHEN the device has no network and the user opens the incident
- THEN the system MUST load local incident, cell, and operational summary data
- AND it MUST show that the view is offline or partially synchronized.

#### Scenario: Missing local data

- GIVEN no local data exists for a requested incident or cell
- WHEN the user attempts to open it offline
- THEN the system MUST explain that the incident or cell is not available locally
- AND it MUST NOT imply that fresh operational data exists.

### Requirement: Signed append-only operation outbox

The system MUST record each critical mutation as an idempotent signed operation before updating local views.

#### Scenario: Create operation offline

- GIVEN a local actor key is available
- WHEN the user creates an incident, work center, presence event, resource report, dispatch event, or SOS
- THEN the system MUST create a signed outbox operation with incident, cell, entity, operation type, timestamp, and sync state
- AND the operation MUST remain pending until transport confirms another state.

#### Scenario: Signing unavailable

- GIVEN the app cannot access signing material
- WHEN a critical mutation is requested
- THEN the system MUST block the mutation and show a recoverable signing error
- AND it MUST NOT create an unsigned critical operation.

### Requirement: Local materialized operational views

The system MUST materialize local views from accepted local operations so field users see immediate results while offline.

#### Scenario: Materialize pending center

- GIVEN a valid `work_center.create` operation is stored locally
- WHEN the materialized views refresh
- THEN the work center MUST appear locally with `pending` state and operation sync status
- AND role counts, resources, freshness, and risk summaries MUST derive from local operations when available.

#### Scenario: Duplicate operation replay

- GIVEN the same operation is processed more than once
- WHEN materialization runs again
- THEN derived views MUST remain idempotent and MUST NOT duplicate centers, counts, reports, or outbox entries.

### Requirement: Migration and reset safety

The system MUST support versioned local schemas and a spike-safe local reset path without backend migration assumptions.

#### Scenario: Supported migration

- GIVEN local data exists on a supported previous schema version
- WHEN the app starts after an upgrade
- THEN the system MUST migrate local collections before exposing operational screens
- AND it MUST preserve pending signed operations.

#### Scenario: Reset spike data

- GIVEN the spike local store is corrupted or intentionally reset
- WHEN the user confirms local incident data removal
- THEN the system MUST remove local spike data for that incident
- AND it MUST communicate that unsynchronized operations may be lost.
