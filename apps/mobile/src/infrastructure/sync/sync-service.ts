import type { SignedOperation, SyncConflict, SyncPushResult } from '@zona-cero/contracts';
import type { LocalOperationDatabase, SyncIssueLocalView, SyncOperationLocalDocument } from '@/infrastructure/local-db/local-db';
import { materializeOperations } from '@/infrastructure/oplog/materializer';
import { isSignedOperation, replaceMaterializedOperationViews } from '@/infrastructure/oplog/outbox-service';
import { createSyncObservabilityEvent, emitNativeOperationalEvent, type NativeObservabilitySink } from '@/infrastructure/observability';
import type { ScopedSyncClient } from './sync-client';

export type ScopedOperationSyncService = {
  sync(input: SyncScopeInput): Promise<ScopedSyncResult>;
};

export type SyncScopeInput = {
  incidentId: string;
  cellId: string;
  cursor?: string | null;
  limit?: number;
};

export type ScopedOperationSyncServiceOptions = {
  database: LocalOperationDatabase;
  client: ScopedSyncClient;
  clock?: () => string;
  nowMs?: () => number;
  retryDelayMs?: number;
  observabilitySink?: NativeObservabilitySink;
};

export type ScopedSyncResult = {
  pushed: number;
  pulled: number;
  confirmed: number;
  conflicts: number;
  rejected: number;
  cursor: string | null;
  hasMore: boolean;
};

export function createScopedOperationSyncService(options: ScopedOperationSyncServiceOptions): ScopedOperationSyncService {
  const clock = options.clock ?? (() => new Date().toISOString());
  const retryDelayMs = options.retryDelayMs ?? 30_000;
  const nowMs = options.nowMs ?? (() => Date.now());

  return {
    async sync(input) {
      const startedAt = nowMs();
      const pendingOperations = await listPushableOperations(options.database, input);
      const attemptAt = clock();
      let confirmed = 0;
      let conflicts = 0;
      let rejected = 0;
      let pulled = 0;
      let failureAlreadyObserved = false;

      try {
        if (pendingOperations.length > 0) {
          await Promise.all(pendingOperations.map((operation) => markOperationSent(options.database, operation, attemptAt)));
        }

        try {
          if (pendingOperations.length > 0) {
            const pushResponse = await options.client.push({ ...input, operations: pendingOperations, cursor: input.cursor ?? null });

            for (const result of pushResponse.results) {
              const applied = await applyPushResult(options.database, pendingOperations, result, clock());
              confirmed += applied.confirmed;
              conflicts += applied.conflicts;
              rejected += applied.rejected;
            }
          }
        } catch (error) {
          await Promise.all(pendingOperations.map((operation) => markOperationRetryable(options.database, operation, error, clock(), retryDelayMs)));
          await replayIncidentViews(options.database, input.incidentId);
          failureAlreadyObserved = true;
          emitSyncObservability(options.observabilitySink, {
            result: 'rejected',
            durationMs: nowMs() - startedAt,
            pushed: pendingOperations.length,
            pulled,
            confirmed,
            conflicts,
            rejected,
            retried: pendingOperations.length,
            error,
            errorCode: 'network_error',
          });
          throw error;
        }

        const pullResponse = await options.client.pull({ ...input, cursor: input.cursor ?? null, limit: input.limit });
        pulled = pullResponse.operations.length;

        for (const pulledOperation of pullResponse.operations) {
          await options.database.syncOps.upsert({
            ...pulledOperation.operation,
            syncState: 'confirmed',
            serverVersion: pulledOperation.serverVersion,
            serverUpdatedAt: pulledOperation.serverUpdatedAt,
          });
        }

        for (const conflict of pullResponse.conflicts) {
          await options.database.views.syncIssues.upsert(createIssueFromConflict(input, conflict, clock()));
        }

        await replayIncidentViews(options.database, input.incidentId);

        const result = {
          pushed: pendingOperations.length,
          pulled,
          confirmed,
          conflicts: conflicts + pullResponse.conflicts.length,
          rejected,
          cursor: pullResponse.cursor,
          hasMore: pullResponse.hasMore,
        };

        emitSyncObservability(options.observabilitySink, {
          result: 'accepted',
          durationMs: nowMs() - startedAt,
          pushed: result.pushed,
          pulled: result.pulled,
          confirmed: result.confirmed,
          conflicts: result.conflicts,
          rejected: result.rejected,
          retried: 0,
        });

        return result;
      } catch (error) {
        if (!failureAlreadyObserved) {
          emitSyncObservability(options.observabilitySink, {
            result: 'rejected',
            durationMs: nowMs() - startedAt,
            pushed: pendingOperations.length,
            pulled,
            confirmed,
            conflicts,
            rejected,
            retried: 0,
            error,
          });
        }

        throw error;
      }
    },
  };
}

async function listPushableOperations(database: LocalOperationDatabase, input: SyncScopeInput): Promise<SignedOperation[]> {
  const operations = await database.syncOps.findByIncident(input.incidentId);

  return operations
    .filter(isSignedOperation)
    .filter((operation) => operation.cellId === input.cellId)
    .filter((operation) => operation.syncState === 'pending' || operation.syncState === 'sent')
    .sort((left, right) => left.hlc.localeCompare(right.hlc));
}

async function markOperationSent(database: LocalOperationDatabase, operation: SignedOperation, attemptAt: string): Promise<void> {
  await database.syncOps.upsert({
    ...operation,
    syncState: 'sent',
    lastSyncAttemptAt: attemptAt,
    retryCount: readRetryCount(operation),
    nextRetryAt: undefined,
    syncErrorCode: undefined,
    syncErrorMessage: undefined,
    conflict: undefined,
  });
}

async function markOperationRetryable(database: LocalOperationDatabase, operation: SignedOperation, error: unknown, attemptAt: string, retryDelayMs: number): Promise<void> {
  const retryCount = readRetryCount(operation) + 1;
  const nextRetryAt = new Date(Date.parse(attemptAt) + retryDelayMs * retryCount).toISOString();

  await database.syncOps.upsert({
    ...operation,
    syncState: 'pending',
    lastSyncAttemptAt: attemptAt,
    retryCount,
    nextRetryAt,
    syncErrorCode: 'network_error',
    syncErrorMessage: error instanceof Error ? error.message : 'Sync request failed',
  });
}

async function applyPushResult(database: LocalOperationDatabase, pushedOperations: SignedOperation[], result: SyncPushResult, now: string): Promise<Pick<ScopedSyncResult, 'confirmed' | 'conflicts' | 'rejected'>> {
  if (result.status === 'accepted') {
    const operation = pushedOperations.find((candidate) => candidate.opId === result.opId);

    if (!operation) {
      return { confirmed: 0, conflicts: 0, rejected: 0 };
    }

    const confirmedOperation = clearRetryMetadata(operation);

    await database.syncOps.upsert({
      ...confirmedOperation,
      entityId: result.entityId ?? operation.entityId,
      syncState: 'confirmed',
      serverVersion: result.serverVersion,
      serverUpdatedAt: result.serverUpdatedAt,
      conflict: undefined,
    });

    return { confirmed: 1, conflicts: 0, rejected: 0 };
  }

  const operation = result.opId ? pushedOperations.find((candidate) => candidate.opId === result.opId) : undefined;
  const conflict = result.conflict;
  const state = conflict ? 'conflict' : 'rejected';

  if (operation) {
    await database.syncOps.upsert({
      ...operation,
      syncState: state,
      syncErrorCode: result.code,
      syncErrorMessage: result.message,
      conflict,
    });
  }

  await database.views.syncIssues.upsert(createIssueFromRejectedResult(result, operation, now));

  return { confirmed: 0, conflicts: conflict ? 1 : 0, rejected: conflict ? 0 : 1 };
}

async function replayIncidentViews(database: LocalOperationDatabase, incidentId: string): Promise<void> {
  const operations = (await database.syncOps.findByIncident(incidentId)).filter(isSignedOperation);
  const views = materializeOperations(operations);

  await replaceMaterializedOperationViews(database, incidentId, views);
}

function createIssueFromRejectedResult(result: Extract<SyncPushResult, { status: 'rejected' }>, operation: SignedOperation | undefined, updatedAt: string): SyncIssueLocalView {
  const conflict = result.conflict;
  const opId = result.opId ?? operation?.opId ?? conflict?.opId;
  const entityId = conflict?.entityId ?? operation?.entityId;
  const code = conflict?.code ?? result.code;

  return {
    issueId: `push:${opId ?? entityId ?? code}`,
    incidentId: operation?.incidentId ?? 'unknown-incident',
    cellId: operation?.cellId ?? 'unknown-cell',
    state: conflict ? 'conflict' : 'rejected',
    code,
    message: conflict?.message ?? result.message,
    opId,
    entityId,
    entityType: conflict?.entityType ?? operation?.entityType,
    serverVersion: conflict?.serverVersion,
    serverUpdatedAt: conflict?.serverUpdatedAt,
    updatedAt,
  };
}

function createIssueFromConflict(scope: SyncScopeInput, conflict: SyncConflict, updatedAt: string): SyncIssueLocalView {
  return {
    issueId: `pull:${conflict.opId ?? conflict.entityId ?? conflict.code}`,
    incidentId: scope.incidentId,
    cellId: scope.cellId,
    state: 'conflict',
    code: conflict.code,
    message: conflict.message,
    opId: conflict.opId,
    entityId: conflict.entityId,
    entityType: conflict.entityType,
    serverVersion: conflict.serverVersion,
    serverUpdatedAt: conflict.serverUpdatedAt,
    updatedAt,
  };
}

function readRetryCount(operation: SignedOperation): number {
  return typeof (operation as Partial<SyncOperationLocalDocument>).retryCount === 'number' ? (operation as Partial<SyncOperationLocalDocument>).retryCount! : 0;
}

function clearRetryMetadata(operation: SignedOperation): SignedOperation {
  const { retryCount, lastSyncAttemptAt, nextRetryAt, syncErrorCode, syncErrorMessage, ...confirmedOperation } = operation as SignedOperation & Partial<SyncOperationLocalDocument>;

  void retryCount;
  void lastSyncAttemptAt;
  void nextRetryAt;
  void syncErrorCode;
  void syncErrorMessage;

  return confirmedOperation;
}


function emitSyncObservability(
  sink: NativeObservabilitySink | undefined,
  input: Parameters<typeof createSyncObservabilityEvent>[0],
): void {
  emitNativeOperationalEvent(sink, createSyncObservabilityEvent(input));
}
