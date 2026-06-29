# Offline Map Packs Specification

## Purpose

Define offline map pack behavior by incident and cell so field users can prepare, inspect, use, update, and clean up map coverage without confusing map availability with operational data freshness.

## Requirements

### Requirement: Incident and cell scoped map packs

The system MUST manage offline map packs by incident and operational cell, including coverage, size, download state, and last update metadata.

#### Scenario: Prepare current cell

- GIVEN the user has selected an incident and current operational cell
- WHEN map preparation is opened
- THEN the system MUST show the current cell, adjacent suggested cells, pack status, coverage, and estimated size
- AND it MUST allow downloading the current cell pack when network is available.

#### Scenario: Network unavailable during preparation

- GIVEN the device is offline
- WHEN the user opens map preparation
- THEN the system MUST show locally available packs and unavailable packs separately
- AND it MUST allow continuing only with available local coverage.

### Requirement: Download lifecycle visibility

The system MUST expose map pack lifecycle states in testable user-facing terms: not available, queued, downloading, partial, downloaded, failed, and update recommended.

#### Scenario: Download progresses

- GIVEN a cell pack download has started
- WHEN progress changes
- THEN the system MUST show progress and the current lifecycle state
- AND it MUST keep partial coverage distinguishable from complete coverage.

#### Scenario: Download fails

- GIVEN a pack download is interrupted or rejected
- WHEN the failure is detected
- THEN the system MUST mark the pack as failed or partial
- AND it MUST provide a retry path without deleting already usable completed packs.

### Requirement: Offline map rendering state

The system MUST render available offline map coverage for prepared cells and clearly identify whether the map is offline, online, partial, or missing coverage.

#### Scenario: Render prepared cell offline

- GIVEN a downloaded map pack exists for the active cell
- WHEN the device has no network and the map opens
- THEN the system MUST render the cell from local map coverage
- AND it MUST show an offline map indicator.

#### Scenario: Coverage gap

- GIVEN the visible map area extends outside downloaded coverage
- WHEN the user pans into that area offline
- THEN the system MUST show a partial or missing coverage state
- AND it MUST NOT hide the fact that base map data may be unavailable.

### Requirement: Map storage cleanup

The system MUST let users inspect and delete offline packs by incident or cell while protecting the currently active operational pack from accidental removal.

#### Scenario: Delete inactive pack

- GIVEN an inactive incident or cell has downloaded map data
- WHEN the user confirms deletion
- THEN the system MUST remove that pack and update storage status
- AND it MUST leave unrelated packs intact.

#### Scenario: Active pack deletion warning

- GIVEN the user attempts to delete the active cell pack
- WHEN deletion is requested
- THEN the system MUST require explicit confirmation
- AND it MUST warn that offline map coverage for the active operation will be lost.

### Requirement: Separate map freshness from operational freshness

The system MUST distinguish offline map pack age from operational data freshness.

#### Scenario: Fresh map with stale operations

- GIVEN the map pack is downloaded but local operational data is stale
- WHEN the map screen renders
- THEN the system MUST show map coverage as available
- AND it MUST separately show degraded or obsolete operational freshness.
