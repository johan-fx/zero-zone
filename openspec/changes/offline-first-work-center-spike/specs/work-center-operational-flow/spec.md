# Work Center Operational Flow Specification

## Purpose

Define the map-first incident and work-center flow that uses local operations, offline map state, selected-center panels, pending sync, and freshness indicators while preserving existing preview surfaces.

## Requirements

### Requirement: Map-first incident entry

The system MUST guide users from incident selection or creation into an operational map surface with incident, cell, connectivity, freshness, outbox, and tracking state visible.

#### Scenario: Enter prepared incident

- GIVEN a user selects an incident with local cell data
- WHEN the incident opens
- THEN the system MUST show the operational map as the primary surface
- AND it MUST display incident, cell, connectivity, freshness, outbox, and tracking indicators.

#### Scenario: Create unverified incident offline

- GIVEN the device is offline and signing is available
- WHEN the user creates an incident locally
- THEN the system MUST create a pending signed `incident.create` operation
- AND it MUST show the incident as `unverified` and locally pending.

### Requirement: Work center creation from the map

The system MUST let users create a work center from the map with minimal required input and immediate local pending visibility.

#### Scenario: Create center offline

- GIVEN the user is viewing an incident map offline
- WHEN the user creates a work center with type, approximate location, brief description, priority, and optional initial need
- THEN the system MUST create a signed `work_center.create` operation
- AND the center MUST appear locally as `pending` with sync status.

#### Scenario: Prevent false activation

- GIVEN a work center was created by a single local action
- WHEN the map and panel render the new center
- THEN the system MUST NOT mark it as `active`
- AND it MUST explain that activation requires sufficient evidence.

### Requirement: Selected-center operational panel

The system MUST show selected-center details through progressive disclosure without exposing individual volunteer identities.

#### Scenario: Select a center

- GIVEN centers are visible on the operational map
- WHEN the user selects a center
- THEN the system MUST show state, confidence, freshness, risk, needs, surplus, aggregate role counts, and available actions
- AND it MUST use text plus iconography rather than color alone.

#### Scenario: Stale center data

- GIVEN a selected center has stale role, need, surplus, or confidence data
- WHEN the panel renders
- THEN the system MUST degrade stale fields visually and textually
- AND stale data MUST NOT appear equally actionable as recent data.

### Requirement: Active volunteer and presence controls

The system MUST expose volunteer availability and presence tracking as explicit user-controlled states.

#### Scenario: Check in to center

- GIVEN a center is selected and signing is available
- WHEN the user checks in
- THEN the system MUST create a signed `presence.check_in` operation
- AND the UI MUST show tracking as active, degraded, paused, or stopped.

#### Scenario: Pause or check out

- GIVEN the user has an active presence session
- WHEN the user pauses tracking or checks out
- THEN the system MUST create the corresponding signed operation
- AND aggregate role counts MUST eventually degrade or remove that session according to freshness rules.

### Requirement: Preserve preview access

The system MUST preserve existing preview and visual-audit surfaces while operational screens move from mock data to live local state.

#### Scenario: Open preview route

- GIVEN preview or visual-audit routes exist
- WHEN a user opens those routes after the operational flow is wired
- THEN the system MUST keep preview surfaces available
- AND preview data MUST remain clearly separate from live operational data.
